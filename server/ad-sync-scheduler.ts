import cron from 'node-cron';
import winston from 'winston';
import { storage } from './storage';
import ldap from 'ldapjs';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level.toUpperCase()}: ${message}`)
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/ad-sync.log' })
  ]
});

interface ADSyncConfig {
  enabled: boolean;
  schedule: string;
  retryAttempts: number;
  retryDelay: number;
}

class ADSyncScheduler {
  private task: cron.ScheduledTask | null = null;
  private config: ADSyncConfig;
  private isRunning = false;
  private lastSyncTime: Date | null = null;
  private lastSyncSuccess = false;

  constructor(config: Partial<ADSyncConfig> = {}) {
    this.config = {
      enabled: config.enabled !== false,
      schedule: config.schedule || '0 23 * * *', // 23:00 каждый день
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 5000 // 5 секунд
    };
  }

  public start(): void {
    if (!this.config.enabled) {
      logger.info('AD Sync Scheduler is disabled');
      return;
    }

    if (this.task) {
      logger.warn('AD Sync Scheduler is already running');
      return;
    }

    // Валидирование cron расписания
    if (!cron.validate(this.config.schedule)) {
      logger.error(`Invalid cron schedule: ${this.config.schedule}`);
      throw new Error(`Invalid cron schedule: ${this.config.schedule}`);
    }

    this.task = cron.schedule(this.config.schedule, () => {
      this.executeSync();
    });

    logger.info(`AD Sync Scheduler started with schedule: ${this.config.schedule}`);
  }

  public stop(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
      logger.info('AD Sync Scheduler stopped');
    }
  }

  public async executeSync(): Promise<void> {
    if (this.isRunning) {
      logger.warn('AD Sync is already running, skipping this scheduled execution');
      return;
    }

    this.isRunning = true;
    const startTime = new Date();
    
    try {
      logger.info('Starting scheduled AD synchronization...');
      
      // Пытаемся выполнить синхронизацию с повторными попытками
      let lastError: Error | null = null;
      
      for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
        try {
          await this.performSync();
          const duration = Date.now() - startTime.getTime();
          logger.info(`AD Sync completed successfully in ${duration}ms`);
          this.lastSyncTime = new Date();
          this.lastSyncSuccess = true;
          return;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          logger.warn(`AD Sync attempt ${attempt}/${this.config.retryAttempts} failed: ${lastError.message}`);
          
          if (attempt < this.config.retryAttempts) {
            await this.delay(this.config.retryDelay);
          }
        }
      }
      
      // Все попытки исчерпаны
      if (lastError) {
        logger.error(`AD Sync failed after ${this.config.retryAttempts} attempts: ${lastError.message}`);
        this.lastSyncTime = new Date();
        this.lastSyncSuccess = false;
      }
    } catch (error) {
      logger.error(`Unexpected error during AD Sync: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.isRunning = false;
    }
  }

  private async performSync(): Promise<void> {
    logger.info('AD Sync operation started');

    try {
      // Проверяем что LDAP настроен
      const LDAP_URL = process.env.LDAP_URL;
      const BIND_DN = process.env.LDAP_BIND_DN;
      const BIND_PASSWORD = process.env.LDAP_BIND_PASSWORD;
      const BASE_DN = process.env.LDAP_BASE_DN;

      if (!LDAP_URL || !BIND_DN || !BIND_PASSWORD || !BASE_DN) {
        logger.warn('AD Sync skipped: LDAP is not configured');
        return;
      }

      // Helper function for LDAP filter escaping
      const escapeLdapFilter = (value: string): string => {
        if (!value) return '';
        return value
          .replace(/\\/g, '\\5c')
          .replace(/\*/g, '\\2a')
          .replace(/\(/g, '\\28')
          .replace(/\)/g, '\\29')
          .replace(/\x00/g, '\\00');
      };

      // Initialize LDAP client
      const client = ldap.createClient({ url: LDAP_URL });
      let clientErrored = false;
      const onClientError = (err: any) => { clientErrored = true; };
      client.on('error', onClientError);

      // Build bind candidates
      const candidates: string[] = [];
      if (BIND_DN) candidates.push(BIND_DN);
      let rdnName: string | null = null;
      try {
        if (BIND_DN && BIND_DN.includes(',')) {
          const first = BIND_DN.split(',')[0];
          if (first.includes('=')) rdnName = first.split('=')[1];
        }
      } catch (e) { /* ignore */ }
      if (rdnName) candidates.push(rdnName);

      let domain: string | null = null;
      try {
        if (BASE_DN) {
          const parts = BASE_DN.split(',').map(p => p.trim()).filter(p => p.toUpperCase().startsWith('DC='));
          domain = parts.map(p => p.split('=')[1]).join('.');
        }
      } catch (e) { domain = null; }
      if (rdnName && domain) candidates.push(`${rdnName}@${domain}`);

      // Bind to LDAP
      let bound = false;
      let lastBindError: any = null;
      for (const bindStr of candidates) {
        if (!bindStr) continue;
        try {
          await new Promise<void>((resolve, reject) => {
            let called = false;
            client.bind(bindStr, BIND_PASSWORD, (err: Error | null) => {
              if (called) return;
              called = true;
              if (err) return reject(err);
              resolve();
            });
            setTimeout(() => { if (!called) { called = true; reject(new Error('LDAP bind timeout')); } }, 5000);
          });
          bound = true;
          break;
        } catch (err) {
          lastBindError = err;
        }
      }

      if (!bound) {
        client.removeListener('error', onClientError);
        try { client.unbind(); } catch (e) {}
        throw new Error(`LDAP bind failed: ${String(lastBindError)}`);
      }

      // Get all workstations to sync
      const all = await storage.getAllLocations();
      const workLocations = all.filter((l) => (l.type === 'workstation' || !l.type) && l.id);

      let successCount = 0;
      let skippedCount = 0;
      let failedCount = 0;

      // Search helper
      const searchByLogin = (login: string) => new Promise<any>((resolve, reject) => {
        const q = escapeLdapFilter(login);
        const opts = { 
          filter: `(|(sAMAccountName=${q})(userPrincipalName=${q})(cn=${q})(mail=${q}))`, 
          scope: 'sub' as const, 
          attributes: ['*'] 
        };
        client.search(BASE_DN!, opts, (err: any, ldapRes: any) => {
          if (err) return reject(err);
          let user: any = null;
          ldapRes.on('searchEntry', (entry: any) => {
            try {
              if (entry && entry.object && Object.keys(entry.object).length) {
                user = entry.object;
                return;
              }
            } catch {}
            if (entry && Array.isArray(entry.attributes) && entry.attributes.length) {
              const obj: Record<string, any> = {};
              for (const attr of entry.attributes) {
                try {
                  const vals = (attr && (attr.values || attr.vals || attr._vals)) || attr;
                  if (Array.isArray(vals) && vals.length === 1) obj[attr.type || attr.typeName || attr.attribute] = vals[0];
                  else obj[attr.type || attr.typeName || attr.attribute] = vals;
                } catch {
                  obj[attr.type || attr.typeName || attr.attribute] = attr;
                }
              }
              user = obj;
              return;
            }
          });
          ldapRes.on('error', (e: any) => reject(e));
          ldapRes.on('end', () => resolve(user));
        });
      });

      // Process each location
      for (const loc of workLocations) {
        try {
          const employeeMarker = await storage.getMarker(loc.id, 'employee');
          const login = employeeMarker?.value?.trim();
          
          if (!login) {
            skippedCount++;
            continue;
          }

          const user = await searchByLogin(login);
          if (!user) {
            failedCount++;
            continue;
          }

          // Build update payload from AD data
          const current = await storage.getLocation(loc.id);
          const currentName = current?.name || '';
          const currentCF: Record<string, any> = (current && current.customFields && typeof current.customFields === 'object') ? { ...(current.customFields as any) } : {};

          const nameParts: string[] = [];
          if (user.cn) nameParts.push(user.cn as string);
          if ((user as any).middleName) nameParts.push((user as any).middleName as string);
          const desiredName = nameParts.length ? nameParts.join(' ') : (currentName || login);

          const desiredCF: Record<string, any> = { ...currentCF };
          if (user.department) desiredCF.department = user.department;
          if (user.title) desiredCF.position = user.title;
          if (user.mail) desiredCF.email = user.mail;
          if (user.extensionAttribute3) desiredCF.telegram = user.extensionAttribute3;
          if (user.mailNickname) desiredCF.logonCount = user.mailNickname;

          // Check if anything changed
          let didChange = false;
          if (desiredName !== currentName) didChange = true;
          const cfSame = JSON.stringify(desiredCF || {}) === JSON.stringify(currentCF || {});
          if (!cfSame) didChange = true;

          if (!didChange) {
            skippedCount++;
            continue;
          }

          // Apply updates
          try {
            const updatePayload: any = { id: loc.id };
            if (desiredName !== currentName) updatePayload.name = desiredName;
            updatePayload.customFields = desiredCF;
            await storage.updateLocation(updatePayload as any);
            successCount++;
          } catch (e) {
            failedCount++;
          }
        } catch (e) {
          failedCount++;
        }
      }

      client.removeListener('error', onClientError);
      try { client.unbind(); } catch {}

      logger.info(`AD Sync completed successfully. Updated: ${successCount}, Skipped: ${skippedCount}, Failed: ${failedCount}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`AD Sync operation failed: ${message}`);
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public getStatus(): {
    enabled: boolean;
    isRunning: boolean;
    schedule: string;
    nextExecution?: Date;
    lastSyncTime?: Date;
    lastSyncSuccess?: boolean;
  } {
    let nextExecution: Date | undefined;
    
    if (this.task) {
      try {
        // node-cron nextDate() returns a Date object or null
        const nextDate = (this.task as any).nextDate?.();
        if (nextDate && nextDate instanceof Date) {
          nextExecution = nextDate;
        }
      } catch (e) {
        // nextDate is not available, that's ok
      }
    }

    return {
      enabled: this.config.enabled,
      isRunning: this.isRunning,
      schedule: this.config.schedule,
      nextExecution,
      lastSyncTime: this.lastSyncTime || undefined,
      lastSyncSuccess: this.lastSyncTime ? this.lastSyncSuccess : undefined
    };
  }
}

// Создаём глобальный экземпляр планировщика
export const adSyncScheduler = new ADSyncScheduler({
  enabled: process.env.AD_SYNC_ENABLED !== 'false',
  schedule: process.env.AD_SYNC_SCHEDULE || '0 23 * * *', // По умолчанию 23:00
  retryAttempts: parseInt(process.env.AD_SYNC_RETRY_ATTEMPTS || '3', 10),
  retryDelay: parseInt(process.env.AD_SYNC_RETRY_DELAY || '5000', 10)
});

export type { ADSyncConfig };
export default ADSyncScheduler;
