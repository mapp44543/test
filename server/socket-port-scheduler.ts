import { fetchCiscoPortInfo } from './cisco-port-status';
import { storage } from './storage';
import type { Location } from '@shared/schema';
import winston from 'winston';

// Logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json(),
  ),
  defaultMeta: { service: 'socket-port-scheduler' },
});

// Interface for port batches
interface PortBatch {
  startPort: number;
  endPort: number;
  delayMs: number;
}

// Extract port number from port string (e.g., "Gi1/0/15" -> 15)
function extractPortNumber(port: string): number | null {
  const match = String(port).match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

// Create port batches: [1-10, 11-20, 21-30, etc.]
function createPortBatches(batchSize: number = 10, intervalMs: number = 30 * 60 * 1000): PortBatch[] {
  const batches: PortBatch[] = [];
  for (let i = 1; i <= 48; i += batchSize) {
    const startPort = i;
    const endPort = Math.min(i + batchSize - 1, 48);
    const batchIndex = Math.floor((i - 1) / batchSize);
    batches.push({
      startPort,
      endPort,
      delayMs: batchIndex * intervalMs,
    });
  }
  return batches;
} 

class SocketPortScheduler {
  private isRunning = false;
  private timeouts: Map<number, NodeJS.Timeout> = new Map();
  // Allow overriding batch size / interval via env vars for flexibility
  private readonly batchSize = Number(process.env.SOCKET_BATCH_SIZE) || 10;
  private readonly intervalMs = (Number(process.env.SOCKET_BATCH_INTERVAL_MINUTES) || 30) * 60 * 1000; // minutes
  private broadcastFn?: (data: any) => void;

  constructor() {}

  // Set broadcast function to notify clients of updates
  setBroadcastFn(fn: (data: any) => void) {
    this.broadcastFn = fn;
  }

  /**
   * Start periodic synchronization of socket port statuses
   */
  start() {
    if (this.isRunning) {
      logger.warn('Socket Port Scheduler is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Socket Port Scheduler started');

    // Schedule all batches
    this.schedulePortBatches();
  }

  /**
   * Stop the scheduler and clear all pending timeouts
   */
  stop() {
    this.isRunning = false;
    logger.info('Socket Port Scheduler stopped');

    // Clear all timeouts
    Array.from(this.timeouts.values()).forEach(timeout => {
      clearTimeout(timeout);
    });
    this.timeouts.clear();
  }

  /**
   * Schedule port batches with intervals
   */
  private schedulePortBatches() {
    const batches = createPortBatches(this.batchSize, this.intervalMs);

    for (const batch of batches) {
      const batchKey = batch.startPort;
      const timeout = setTimeout(
        () => this.processBatch(batch),
        batch.delayMs,
      );
      this.timeouts.set(batchKey, timeout);

      logger.info(
        `Batch [${batch.startPort}-${batch.endPort}] scheduled to run in ${batch.delayMs / 1000}s (${batch.delayMs / 60000} min)`,
      );
    }
  }

  /**
   * Process a batch of ports
   */
  private async processBatch(batch: PortBatch) {
    logger.info(`Processing batch [${batch.startPort}-${batch.endPort}]`);

    try {
      // Get all socket locations from database
      const allLocations = await storage.getAllLocations();
      const socketLocations = (allLocations as Location[]).filter(
        (loc: Location) => loc.type === 'socket' && loc.id,
      );

      // Filter locations for this batch
      const batchLocations = (socketLocations as Location[]).filter((loc: Location) => {
        const customFields = (loc.customFields || {}) as Record<string, any>;
        const portStr = customFields.port || customFields.Port || '';
        const portNum = extractPortNumber(portStr);
        return portNum && portNum >= batch.startPort && portNum <= batch.endPort;
      });

      logger.info(
        `Found ${batchLocations.length} locations in batch [${batch.startPort}-${batch.endPort}]`,
      );

      // Sync each location in the batch
      for (const location of batchLocations) {
        await this.syncLocationPortStatus(location);
      }

      logger.info(
        `Batch [${batch.startPort}-${batch.endPort}] processed successfully`,
      );

      // Schedule next batch cycle only after the last batch completes
      const totalBatches = Math.ceil(48 / this.batchSize);
      const batchIndex = Math.floor((batch.startPort - 1) / this.batchSize);
      const totalCycleTime = totalBatches * this.intervalMs;
      const nextCycleDelay = totalCycleTime;

      if (batchIndex === totalBatches - 1) {
        this.scheduleNextCycle(nextCycleDelay);
      }
    } catch (error) {
      logger.error(
        `Error processing batch [${batch.startPort}-${batch.endPort}]:`,
        error,
      );
    }
  }

  /**
   * Schedule the next batch cycle
   */
  private scheduleNextCycle(delay: number) {
    // Clear existing timeouts first
    Array.from(this.timeouts.values()).forEach(timeout => {
      clearTimeout(timeout);
    });
    this.timeouts.clear();

    // Schedule next cycle
    if (this.isRunning) {
      setTimeout(() => {
        if (this.isRunning) {
          logger.info('Starting new port sync cycle');
          this.schedulePortBatches();
        }
      }, delay);
    }
  }

  /**
   * Sync port status for a single location
   */
  private async syncLocationPortStatus(location: Location) {
    try {
      const customFields =
        (location.customFields && typeof location.customFields === 'object')
          ? (location.customFields as Record<string, any>)
          : {};

      const portRaw = customFields.port || customFields.Port || '';
      const portArg = String(portRaw).split('/').pop()?.replace(/\D/g, '') || '';

      if (!portArg) {
        logger.warn(`Location ${location.id} has no valid port number`);
        return;
      }

      const ciscoSite = customFields.ciscoSite || location.floor || '5';

      logger.debug(
        `Syncing port ${portArg} for location ${location.id} (site: ${ciscoSite})`,
      );

      let parsed;
      try {
        parsed = await fetchCiscoPortInfo(portArg, ciscoSite);
      } catch (ciscoError) {
        logger.warn(
          `Failed to fetch Cisco info for port ${portArg}: ${ciscoError instanceof Error ? ciscoError.message : String(ciscoError)}`,
        );
        // Continue without Cisco data update
        return;
      }

      const nowIso = new Date().toISOString();
      const updatedCF = {
        ...(location.customFields as Record<string, any>) || {},
      };

      // Update with fetched Cisco data using canonical keys expected by client
      const portVal = parsed.Port || parsed.port || '';
      if (portVal) { updatedCF.port = portVal; updatedCF.Port = portVal; }

      const nameVal = parsed.Name || parsed.name || '';
      if (nameVal) { updatedCF.Name = nameVal; updatedCF.name = nameVal; }

      const statusVal = parsed.Status || parsed.status || '';
      if (statusVal) {
        updatedCF.Status = statusVal;
        updatedCF.status = statusVal;
        updatedCF.ciscoStatus = statusVal;
        updatedCF.CiscoStatus = statusVal;
      }

      const vlanVal = parsed.Vlan || parsed.vlan || '';
      if (vlanVal) { updatedCF.Vlan = vlanVal; updatedCF.vlan = vlanVal; }

      const duplexVal = parsed.Duplex || parsed.duplex || '';
      if (duplexVal) { updatedCF.Duplex = duplexVal; updatedCF.duplex = duplexVal; }

      const speedVal = parsed.Speed || parsed.speed || '';
      if (speedVal) { updatedCF.Speed = speedVal; updatedCF.speed = speedVal; }

      const typeVal = parsed.Type || parsed.type || '';
      if (typeVal) { updatedCF.Type = typeVal; updatedCF.type = typeVal; }

      // Timestamp when Cisco data was fetched
      updatedCF.StatusLastSync = nowIso;

      // Update location in database
      const updatedLocation = await storage.updateLocation({
        id: location.id,
        customFields: updatedCF,
      } as any);

      logger.info(
        `Location ${location.id} port status updated successfully`,
      );

      // Broadcast update to connected clients
      if (this.broadcastFn && updatedLocation) {
        try {
          this.broadcastFn({
            type: 'LOCATION_UPDATED',
            location: updatedLocation,
          });
        } catch (e) {
          logger.error('Error broadcasting location update for location ' + location.id + ':', e);
        }
      }
    } catch (error) {
      logger.error(
        `Error syncing port status for location ${location.id}:`,
        error instanceof Error ? error.message : String(error),
      );
      // Continue with next location on error
    }
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      batchSize: this.batchSize,
      intervalMs: this.intervalMs,
      timeoutsScheduled: this.timeouts.size,
    };
  }
}

export const socketPortScheduler = new SocketPortScheduler();
export default SocketPortScheduler;
