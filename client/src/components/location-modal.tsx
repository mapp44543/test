import { useState } from "react";
import { X, Save, Trash2, Plus, Upload, ImageOff, Mail, Send, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { useCustomIcons } from "@/hooks/use-custom-icon";
import type { Location } from "@shared/schema";

interface LocationModalProps {
  location: Location;
  isAdminMode: boolean;
  onClose: () => void;
  isHr: boolean;
  updateLocation: (data: Partial<Location>, onSuccess: () => void, onError: () => void) => void;
  deleteLocation: (onSuccess: () => void, onError: () => void) => void;
  toast: (opts: { title: string; description?: string; variant?: string }) => void;
  onFindLocation?: (locationId: string) => void;
}

interface CustomField {
  key: string;
  value: string;
}

import React from "react";
import { formatRelativeTime } from "@/lib/utils";

const LocationModal: React.FC<LocationModalProps> = React.memo(({ location, isAdminMode, onClose, isHr, updateLocation, deleteLocation, toast, onFindLocation }) => {
  // Отладочный вывод при монтировании компонента
  React.useEffect(() => {
    // Component mounted
  }, [location]);

  // Load custom icons for common-area, meeting-room, equipment (print), camera (Камера), ac (кондиционер), and workstation
  const { data: customIcons = [] } = useCustomIcons("common area");
  const { data: meetingRoomIcons = [] } = useCustomIcons("negotiation room");
  const { data: equipmentIcons = [] } = useCustomIcons("print");
  const { data: cameraIcons = [] } = useCustomIcons("Камера");
  const { data: acIcons = [] } = useCustomIcons("ac");
  
  // For workstation, load icons based on status (occupied/available/maintenance)
  const [workstationStatus, setWorkstationStatus] = useState<string>(location.status || "available");
  const statusToFolderMap: Record<string, "occupied" | "available" | "maintenance"> = {
    "occupied": "occupied",
    "available": "available", 
    "maintenance": "maintenance"
  };
  const folderForStatus = statusToFolderMap[workstationStatus] || "available";
  const { data: workstationActivIcons = [] } = useCustomIcons("workstation", { status: "occupied" });
  const { data: workstationNonactivIcons = [] } = useCustomIcons("workstation", { status: "available" });
  const { data: workstationRepairIcons = [] } = useCustomIcons("workstation", { status: "maintenance" });

  // Логирование для отладки
  React.useEffect(() => {
    // Icons loaded
  }, [customIcons, meetingRoomIcons, equipmentIcons, cameraIcons, acIcons]);

  // Сначала извлечём custom fields в удобную переменную — пригодится и для initial state
  const initialCustomFields: Record<string, any> = (() => {
    try {
      if (location.customFields && typeof location.customFields === 'object') {
        const fields = location.customFields as Record<string, any>;
        // Убедимся, что Cisco-поля присутствуют с правильными ключами
        if (location.type === 'socket') {
          // Initializing custom fields
          // Если поля есть в нижнем регистре, преобразуем их в правильный регистр
          ['name', 'status', 'vlan', 'duplex', 'speed', 'type'].forEach(key => {
            const lowerKey = key.toLowerCase();
            const upperKey = key.charAt(0).toUpperCase() + key.slice(1);
            if (fields[lowerKey] && !fields[upperKey]) {
              fields[upperKey] = fields[lowerKey];
              delete fields[lowerKey];
            }
          });
        }
        return fields;
      }
      return {};
    } catch (e) {
      return {};
    }
  })();

  const [formData, setFormData] = useState({
    name: location.name,
    // служебные поля, которые раньше были в customFields
    position: initialCustomFields.position || "",
    department: initialCustomFields.department || "",
    email: initialCustomFields.email || "",
    telegram: initialCustomFields.telegram || "",
    logonCount: initialCustomFields.logonCount,
    // топ-левел
    floor: location.floor || "",
    type: location.type,
    status: location.status,
    equipment: location.equipment || "",
    // Поле для розетки
    port: initialCustomFields.port ?? initialCustomFields.Port ?? "",
    // Which Cisco device/site this port belongs to (5, 9, MSK)
    ciscoSite: (() => {
      const cs = initialCustomFields.ciscoSite || '';
      if (cs) return cs;
      // backward-compat: if top-level floor contains one of the known site keys, use it
      const lf = String(location.floor || '').toLowerCase();
      if (['5', '9', 'msk'].includes(lf)) return lf === 'msk' ? 'MSK' : lf;
      return '';
    })(),
  });

  const [avatar, setAvatar] = useState<string | undefined>(initialCustomFields.avatar as string | undefined);
  const [ciscoLoading, setCiscoLoading] = useState(false);
  const ciscoSyncAbortControllerRef = React.useRef<AbortController | null>(null);
  const ciscoSyncInProgressRef = React.useRef(false);
  
  // State for selected icons (common-area, meeting-room, equipment, camera, ac, and workstation)
  const [selectedIcon, setSelectedIcon] = useState<string>("");
  const [selectedMeetingRoomIcon, setSelectedMeetingRoomIcon] = useState<string>("");
  const [selectedEquipmentIcon, setSelectedEquipmentIcon] = useState<string>("");
  const [selectedCameraIcon, setSelectedCameraIcon] = useState<string>("");
  const [selectedAcIcon, setSelectedAcIcon] = useState<string>("");
  const [selectedWorkstationIcon, setSelectedWorkstationIcon] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>(location.customColor || "emerald");

  // Update selected icon when icons load or type changes
  React.useEffect(() => {
    if (formData.type === 'common-area') {
      const storedIcon = initialCustomFields.customIcon as string | undefined;
      if (storedIcon) {
        setSelectedIcon(storedIcon);
      } else if (customIcons.length > 0) {
        setSelectedIcon(customIcons[0].name);
      }
    } else if (formData.type === 'meeting-room') {
      const storedIcon = initialCustomFields.customIcon as string | undefined;
      if (storedIcon) {
        setSelectedMeetingRoomIcon(storedIcon);
      } else if (meetingRoomIcons.length > 0) {
        setSelectedMeetingRoomIcon(meetingRoomIcons[0].name);
      }
    } else if (formData.type === 'equipment') {
      const storedIcon = initialCustomFields.customIcon as string | undefined;
      if (storedIcon) {
        setSelectedEquipmentIcon(storedIcon);
      } else if (equipmentIcons.length > 0) {
        setSelectedEquipmentIcon(equipmentIcons[0].name);
      }
    } else if (formData.type === 'camera') {
      const storedIcon = initialCustomFields.customIcon as string | undefined;
      if (storedIcon) {
        setSelectedCameraIcon(storedIcon);
      } else if (cameraIcons.length > 0) {
        setSelectedCameraIcon(cameraIcons[0].name);
      }
    } else if (formData.type === 'ac') {
      const storedIcon = initialCustomFields.customIcon as string | undefined;
      if (storedIcon) {
        setSelectedAcIcon(storedIcon);
      } else if (acIcons.length > 0) {
        setSelectedAcIcon(acIcons[0].name);
      }
    } else if (formData.type === 'workstation') {
      const storedIcon = initialCustomFields.customIcon as string | undefined;
      const currentStatus = formData.status || "available";
      setWorkstationStatus(currentStatus);
      
      if (storedIcon) {
        setSelectedWorkstationIcon(storedIcon);
      } else {
        // Select first icon from the appropriate status folder
        const statusMap: Record<string, typeof workstationActivIcons> = {
          "occupied": workstationActivIcons,
          "available": workstationNonactivIcons,
          "maintenance": workstationRepairIcons
        };
        const iconsForStatus = statusMap[currentStatus] || workstationNonactivIcons;
        if (iconsForStatus.length > 0) {
          setSelectedWorkstationIcon(iconsForStatus[0].name);
        }
      }
    }
  }, [customIcons, meetingRoomIcons, equipmentIcons, cameraIcons, acIcons, workstationActivIcons, workstationNonactivIcons, workstationRepairIcons, formData.type, formData.status]);

  const [customFields, setCustomFields] = useState<CustomField[]>(() => {
    // Не показываем только базовые служебные поля
    const hide = new Set(['department', 'position', 'email', 'telegram', 'logonCount', 'avatar', 'port', 'Port', 'customIcon']);
    return Object.entries(initialCustomFields)
      .filter(([key]) => !hide.has(key))
      .map(([key, value]) => ({ key, value: String(value) }));
  });

  // Функция синхронизации с Cisco
  const syncWithCisco = async (portNumber: string, isAutoSync = false) => {
    if (!portNumber) return;
    
    // Если запрос уже идет, не запускаем новый
    if (ciscoSyncInProgressRef.current) {
      console.log('[LocationModal] Cisco sync already in progress, skipping duplicate request');
      return;
    }
    
    // Отменяем предыдущий запрос если он есть
    if (ciscoSyncAbortControllerRef.current) {
      ciscoSyncAbortControllerRef.current.abort();
    }
    
    // Создаем новый AbortController
    ciscoSyncAbortControllerRef.current = new AbortController();
    ciscoSyncInProgressRef.current = true;
    
    if (!isAutoSync) setCiscoLoading(true);
    try {
      const siteParam = encodeURIComponent(formData.ciscoSite || '5');
      const res = await fetch(`/api/cisco-port-status?port=${encodeURIComponent(portNumber)}&site=${siteParam}`, {
        cache: 'no-store',
        signal: ciscoSyncAbortControllerRef.current.signal,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      
      if (!res.ok) {
        throw new Error(`Ошибка HTTP: ${res.status} ${res.statusText}`);
      }

      const responseText = await res.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error('Получен некорректный JSON от сервера');
      }

      if (!data) {
        throw new Error('Нет данных от сервера');
      }

      if (data.error) {
        throw new Error(data.details || data.error);
      }

      if (!data.Port) {
        throw new Error('В ответе отсутствует информация о порте');
      }

      // Обновляем основные данные формы
      setFormData(f => ({ 
        ...f, 
        port: data.Port,
        name: data.Name || data.Port, // Если имя пустое, используем номер порта
        // Обновляем имя даже при автоматической синхронизации
        ...(data.Name ? { name: data.Name } : {})
      }));
      
      // Создаем новый массив полей с данными от Cisco, сохраняя оригинальные ключи
      const nowIso = new Date().toISOString();
      const ciscoFields = [
        { key: 'Name', value: data.Name || '' },
        { key: 'Status', value: data.Status || '' },
        { key: 'Vlan', value: data.Vlan || '' },
        { key: 'Duplex', value: data.Duplex || '' },
        { key: 'Speed', value: data.Speed || '' },
        { key: 'Type', value: data.Type || '' },
        { key: 'StatusLastSync', value: nowIso }
      ].filter(field => field.value !== ''); // Убираем пустые значения
      
      // Обновляем кастомные поля, сохраняя существующие не-Cisco поля
      setCustomFields(prev => {
        // Удаляем старые Cisco-поля (учитывая регистр)
        const nonCiscoFields = prev.filter(f => {
          const key = f.key;
          return !['Name', 'Status', 'Vlan', 'Duplex', 'Speed', 'Type', 'StatusLastSync'].includes(key);
        });
        
        // Добавляем новые Cisco-поля
        return [...nonCiscoFields, ...ciscoFields];
      });

      // Автоматически сохраняем изменения в БД
      const customFieldsObject = {} as Record<string, string>;
      
      // Сохраняем существующие пользовательские поля
      customFields.forEach(field => {
        if (field.key && field.value) {
          customFieldsObject[field.key] = field.value;
        }
      });

      // Явно добавляем Cisco-поля с правильными ключами
      customFieldsObject['Name'] = data.Name || '';
      customFieldsObject['Status'] = data.Status || '';
      customFieldsObject['Vlan'] = data.Vlan || '';
      customFieldsObject['Duplex'] = data.Duplex || '';
      customFieldsObject['Speed'] = data.Speed || '';
      customFieldsObject['Type'] = data.Type || '';
      // Timestamp when Cisco data was fetched
      customFieldsObject['StatusLastSync'] = nowIso;

      // Добавляем служебные поля
      if (formData.department) customFieldsObject.department = formData.department;
      if (formData.position) customFieldsObject.position = formData.position;
      if (formData.email) customFieldsObject.email = formData.email;
      if (formData.telegram) customFieldsObject.telegram = formData.telegram;
      if (typeof formData.logonCount !== 'undefined') customFieldsObject.logonCount = formData.logonCount;
      if (avatar) customFieldsObject.avatar = avatar;

      // Сохраняем порт внутри customFields для розеток
      if (formData.type === 'socket') {
        if (formData.port) {
          customFieldsObject.port = formData.port;
        }
        // Всегда сохраняем ciscoSite для розеток, даже при автоматической синхронизации
        if (formData.ciscoSite) {
          customFieldsObject.ciscoSite = formData.ciscoSite;
        }
      }

      const payload = { ...formData, customFields: customFieldsObject } as any;
      if (formData.type === 'socket') {
        payload.status = location.status;
        // Save selected Cisco site into customFields for later reference
        if (formData.ciscoSite) customFieldsObject.ciscoSite = formData.ciscoSite;
      }

      // Сохраняем в БД
      updateLocation(
        payload,
        () => {
          if (!isAutoSync) {
            const statusInfo = [
              `Порт: ${data.Port}`,
              data.Name && `Имя: ${data.Name}`,
              data.Status && `Статус: ${data.Status}`,
              data.Vlan && `VLAN: ${data.Vlan}`,
              data.Speed && `Скорость: ${data.Speed}`,
              data.Duplex && `Дуплекс: ${data.Duplex}`,
              data.Type && `Тип: ${data.Type}`
            ].filter(Boolean).join('\n');

            toast({ 
              title: 'Данные обновлены', 
              description: statusInfo
            });
          }
        },
        () => {
          if (!isAutoSync) {
            toast({ 
              title: 'Ошибка сохранения', 
              description: 'Данные получены от Cisco, но не удалось сохранить в БД',
              variant: 'destructive' 
            });
          }
        }
      );

    } catch (e) {
      // Не показываем ошибку если запрос был отменен
      if (e instanceof Error && e.name === 'AbortError') {
        console.log('[LocationModal] Cisco sync request was aborted');
        return;
      }
      
      // Показываем ошибку только для ручной синхронизации
      if (!isAutoSync) {
        toast({ 
          title: 'Ошибка синхронизации', 
          description: e instanceof Error ? e.message : 'Неизвестная ошибка',
          variant: 'destructive' 
        });
      }
    } finally {
      if (!isAutoSync) setCiscoLoading(false);
      ciscoSyncInProgressRef.current = false;
    }
  };

  // Автоматическая синхронизация при открытии удалена: синхронизация выполняется только вручную
  // Синхронизация по-прежнему доступна через кнопку "Синхронизировать с Cisco" в UI.


  const handleSave = () => {
    // Создаем объект с полями из customFields
    const customFieldsObject = customFields.reduce((acc, field) => {
      if (field.key && field.value) {
        acc[field.key] = field.value;
      }
      return acc;
    }, {} as Record<string, any>);

    // Если это розетка — сохраняем порт и ciscoSite внутри customFields
    if (formData.type === 'socket') {
      if (formData.port) {
        customFieldsObject.port = formData.port;
        // Имя всегда равно порту для розеток
        formData.name = formData.port;
      } else {
        delete customFieldsObject.port;
      }
      
      // Всегда сохраняем ciscoSite для розеток
      if (formData.ciscoSite) {
        customFieldsObject.ciscoSite = formData.ciscoSite;
      }
    }

    // Если это common-area и выбрана иконка - сохраняем выбор
    if (formData.type === 'common-area' && selectedIcon) {
      customFieldsObject.customIcon = selectedIcon;
    }

    // Если это meeting-room и выбрана иконка - сохраняем выбор
    if (formData.type === 'meeting-room' && selectedMeetingRoomIcon) {
      customFieldsObject.customIcon = selectedMeetingRoomIcon;
    }

    // Если это equipment (МФУ) и выбрана иконка - сохраняем выбор
    if (formData.type === 'equipment' && selectedEquipmentIcon) {
      customFieldsObject.customIcon = selectedEquipmentIcon;
    }

    // Если это camera (Камера) и выбрана иконка - сохраняем выбор
    if (formData.type === 'camera' && selectedCameraIcon) {
      customFieldsObject.customIcon = selectedCameraIcon;
    }

    // Если это ac (кондиционер) и выбрана иконка - сохраняем выбор
    if (formData.type === 'ac' && selectedAcIcon) {
      customFieldsObject.customIcon = selectedAcIcon;
    }

    // Если это workstation (рабочее место) и выбрана иконка - сохраняем выбор
    if (formData.type === 'workstation' && selectedWorkstationIcon) {
      customFieldsObject.customIcon = selectedWorkstationIcon;
    }

    // Добавляем служебные поля
    if (formData.department) customFieldsObject.department = formData.department;
    if (formData.position) customFieldsObject.position = formData.position;
    if (formData.email) customFieldsObject.email = formData.email;
    if (formData.telegram) customFieldsObject.telegram = formData.telegram;
    if (typeof formData.logonCount !== 'undefined') customFieldsObject.logonCount = formData.logonCount;
    
    // Сохраняем avatar внутри customFields
    if (avatar) {
      customFieldsObject.avatar = avatar;
    }
    const payload = { ...formData, customFields: customFieldsObject } as any;
    
    if (formData.type === 'socket') {
      // do not overwrite top-level status for sockets; Cisco status stored in customFields.ciscoStatus
      payload.status = location.status;
    }

    updateLocation(
      payload,
      () => {
        toast({ title: "Успех", description: "Локация обновлена" });
        onClose();
      },
      () => {
        toast({ title: "Ошибка", description: "Не удалось обновить локацию", variant: "destructive" });
      }
    );
  };

  const onPickAvatar = async (file: File) => {
    if (!file) return;
    const isImage = /^image\/(png|jpe?g|webp|gif)$/.test(file.type);
    if (!isImage) {
      toast({ title: "Неверный формат", description: "Загрузите изображение (PNG/JPG/WebP/GIF)", variant: "destructive" });
      return;
    }
    try {
      const compressed = await compressImage(file, 512, 0.8);
      setAvatar(compressed);
    } catch (e) {
      const reader = new FileReader();
      reader.onload = () => setAvatar(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const removeAvatar = () => {
    setAvatar(undefined);
  };

  async function compressImage(file: File, maxSidePx: number, quality: number): Promise<string> {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = url;
      image.decoding = "async" as any;
    });
    const { width, height } = img;
    const scale = Math.min(1, maxSidePx / Math.max(width, height));
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no-2d-context');
    ctx.drawImage(img, 0, 0, targetW, targetH);
    // JPEG даёт лучший коэффициент
    return canvas.toDataURL('image/jpeg', quality);
  }

  const handleDelete = () => {
    // Удаляем без подтверждения
    deleteLocation(
      () => {
        toast({ title: "Успех", description: "Локация удалена" });
        onClose();
      },
      () => {
        toast({ title: "Ошибка", description: "Не удалось удалить локацию", variant: "destructive" });
      }
    );
  };

  const addCustomField = () => {
    setCustomFields([...customFields, { key: "", value: "" }]);
  };

  const removeCustomField = (index: number) => {
    setCustomFields(customFields.filter((_, i) => i !== index));
  };

  const updateCustomField = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...customFields];
    updated[index][field] = value;
    setCustomFields(updated);
  };

  const getStatusColor = (status: string) => {
    if (!status) return "bg-gray-500";
    const s = String(status).toLowerCase();
  // Cisco-style statuses: check negative forms first
  // Treat explicit "notconnect" as disconnected (red)
  if (s.includes('notconnect') || s.includes('not connected')) return 'bg-red-500';
  // up/connected -> green
  if (s.includes('connect') || s.includes('connected') || s === 'up') return 'bg-emerald-500';
  // down/disabled -> red
  if (s === 'down' || s === 'disabled' || s === 'no') return 'bg-red-500';
    // app-level statuses
    switch (s) {
      case "available":
        return "bg-emerald-500";
      case "occupied":
        return "bg-orange-500";
      case "maintenance":
        return "bg-yellow-500";
      default:
        return "bg-gray-500";
    }
  };

  // Вычисляем метки в зависимости от типа
  const isSpecialType = formData.type === 'meeting-room' || formData.type === 'common-area' || formData.type === 'equipment' || formData.type === 'ac' || formData.type === 'camera' || formData.type === 'socket';
  const nameLabel = isSpecialType ? 'Название' : 'ФИО';
  const departmentLabel = isSpecialType ? 'Вид' : 'Отдел';

  // Закрывать модальное окно при нажатии клавиши Escape
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // Cleanup на размонтировании компонента
  React.useEffect(() => {
    return () => {
      // Отменяем любые находящиеся в процессе Cisco запросы
      if (ciscoSyncAbortControllerRef.current) {
        ciscoSyncAbortControllerRef.current.abort();
      }
      ciscoSyncInProgressRef.current = false;
    };
  }, []);

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        // Закрываем модальное окно только если клик произошел на фоне, а не на содержимом окна
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <Card className="w-full max-w-md max-h-[90vh] overflow-hidden">
  <CardContent className="pt-6 overflow-y-auto max-h-[85vh] pr-4 location-modal-content">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-foreground">Детали локации</h3>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClose}
              data-testid="button-close-modal"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-4">
            {/* Avatar */}
            <div className="flex items-start gap-4">
              {avatar ? (
                <Dialog>
                  <DialogTrigger asChild>
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-muted flex items-center justify-center shrink-0 cursor-zoom-in" data-testid="avatar-thumb">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={avatar} alt="avatar" className="w-full h-full object-cover" decoding="async" loading="lazy" />
                    </div>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={avatar} alt="avatar-large" className="w-full h-auto max-h-[75vh] object-contain rounded-md" decoding="async" loading="lazy" />
                  </DialogContent>
                </Dialog>
              ) : (
                <div className="w-16 h-16 rounded-full overflow-hidden bg-muted flex items-center justify-center shrink-0">
                  <ImageOff className="w-6 h-6 text-muted-foreground" />
                </div>
              )}
              {isAdminMode && (
                <div className="flex flex-col gap-2">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => e.target.files && onPickAvatar(e.target.files[0])}
                      data-testid="input-avatar-file"
                    />
                    <Button type="button" variant="outline" size="sm" onClick={() => (document.querySelector('[data-testid="input-avatar-file"]') as HTMLInputElement)?.click()}>
                      <Upload className="w-3 h-3 mr-2" /> Загрузить аватар
                    </Button>
                  </label>
                  {avatar && (
                    <Button type="button" variant="destructive" size="sm" onClick={removeAvatar} data-testid="button-remove-avatar">
                      Удалить аватар
                    </Button>
                  )}
                </div>
              )}
            </div>
            {/* Status Indicator: показываем для socket (используем ciscoStatus) и для остальных типов (используем top-level status) */}
            <div className="flex items-center space-x-3">
              {/* determine Cisco/socket status from customFields (if present) */}
              {/* prefer updated customFields state, fall back to initialCustomFields */}
              {null}
              {(() => {
                const statusVal = formData.type === 'socket'
                  ? (customFields.find(f => f.key === 'Status')?.value ?? initialCustomFields['Status'] ?? '')
                  : (formData.status || '');
                const statusLastSyncRaw = (customFields.find(f => f.key && f.key.toLowerCase() === 'statuslastsync')?.value)
                  ?? initialCustomFields['StatusLastSync']
                  ?? initialCustomFields['statuslastsync']
                  ?? '';
                let statusLastSyncDate: Date | null = null;
                try {
                  if (statusLastSyncRaw) {
                    const d = new Date(String(statusLastSyncRaw));
                    if (!isNaN(d.getTime())) statusLastSyncDate = d;
                  }
                } catch { statusLastSyncDate = null; }

                return (
                  <>
                    <span className={`w-4 h-4 rounded-full ${getStatusColor(statusVal)}`}></span>
                    <span className="font-medium text-foreground capitalize" data-testid="text-location-status">
                      {formData.type === 'socket' ? (statusVal || '—') : (formData.status === 'available' ? 'доступно' : formData.status === 'occupied' ? 'Занято' : formData.status === 'maintenance' ? 'на обслуживании' : formData.status)}
                    </span>
                    {statusLastSyncDate && (
                      <span
                        className="text-muted-foreground text-sm ml-2"
                        data-testid="text-status-last-sync"
                        title={statusLastSyncDate.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'medium' })}
                      >
                        {statusLastSyncDate.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'medium' })}
                      </span>
                    )}
                  </>
                );
              })()}
            </div>
            
            {/* Location Info */}
            <div className="space-y-3">
              {/* Публичный режим */}
              {!isAdminMode && (
                <>
                  <div>
                    <Label htmlFor="name">{isSpecialType ? 'Название' : 'ФИО'}</Label>
                    <Input
                      id="name"
                      type="text"
                      value={formData.name}
                      disabled
                      data-testid="input-location-name"
                    />
                  </div>
                  {!isSpecialType && (
                    <>
                      <div>
                        <Label htmlFor="position">Должность</Label>
                        <Input
                          id="position"
                          type="text"
                          value={formData.position}
                          disabled
                          data-testid="input-location-position"
                        />
                      </div>
                      <div>
                        <Label htmlFor="department">Отдел</Label>
                        <Input
                          id="department"
                          type="text"
                          value={formData.department}
                          disabled
                          data-testid="input-location-department"
                        />
                      </div>
                      <div>
                        <Label htmlFor="email">Почта</Label>
                        <div className="flex gap-2">
                          <Input
                            id="email"
                            type="text"
                            value={formData.email}
                            disabled
                            data-testid="input-location-email"
                            className="flex-1"
                          />
                          {formData.email && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                window.location.href = `mailto:${formData.email}`;
                              }}
                              title="Написать письмо"
                            >
                              <Mail className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="telegram">Телеграмм</Label>
                        <div className="flex gap-2">
                          <Input
                            id="telegram"
                            type="text"
                            value={formData.telegram}
                            disabled
                            data-testid="input-location-telegram"
                            className="flex-1"
                          />
                          {formData.telegram && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                // Open Telegram web version in new tab
                                const username = formData.telegram.replace(/^@+/, '');
                                window.open(`https://t.me/${username}`, '_blank');
                              }}
                              title="Написать в Телеграмм"
                            >
                              <Send className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="logonCount">Mattermost</Label>
                        <div className="flex gap-2">
                          <Input
                            id="logonCount"
                            type="text"
                            value={String(formData.logonCount ?? '')}
                            disabled
                            data-testid="input-location-logonCount"
                            className="flex-1"
                          />
                          {formData.logonCount && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                window.location.href = `mattermost://mm.spectrumdata.ru/spectrumdata/messages/@${formData.logonCount}`;
                              }}
                              title="Открыть в Mattermost"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                  {formData.type === 'socket' ? (
                    <>
                      <div>
                        <Label htmlFor="port">Порт</Label>
                        <Input
                          id="port"
                          type="text"
                          value={formData.port}
                          disabled
                          data-testid="input-location-port"
                        />
                      </div>
                      <div>
                        <Label htmlFor="floor">Этаж</Label>
                        <Input
                          id="floor"
                          type="text"
                          value={formData.floor}
                          disabled
                          data-testid="input-location-floor"
                        />
                      </div>
                      <div>
                        <Label htmlFor="type">Тип</Label>
                        <Input
                          id="type"
                          type="text"
                          value="Розетка"
                          disabled
                          data-testid="input-location-type"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <Label htmlFor="floor">Этаж</Label>
                        <Input
                          id="floor"
                          type="text"
                          value={formData.floor}
                          disabled
                          data-testid="input-location-floor"
                        />
                      </div>
                      <div>
                        <Label htmlFor="type">Тип</Label>
                        <Input
                          id="type"
                          type="text"
                          value={
                            formData.type === 'meeting-room' ? 'Переговорная'
                            : formData.type === 'workstation' ? 'Рабочее место'
                            : formData.type === 'equipment' ? 'МФУ'
                            : formData.type === 'common-area' ? 'Общая зона'
                            : formData.type === 'camera' ? 'Камера'
                            : formData.type === 'ac' ? 'Кондиционер'
                            : formData.type
                          }
                          disabled
                          data-testid="input-location-type"
                        />
                      </div>
                    </>
                  )}
                  {/* Показываем оборудование только для админ режима */}
                  {isAdminMode && formData.type !== 'socket' && (
                    <div>
                      <Label htmlFor="equipment">Оборудование</Label>
                      <Input
                        id="equipment"
                        type="text"
                        value={formData.equipment}
                        disabled
                        data-testid="input-location-equipment"
                      />
                    </div>
                  )}

                  {/* Дополнительные поля только для админ-режима */}
                  {isAdminMode && ((customFields.length > 0 && isSpecialType) || (location.customFields && (location.customFields as any)?.thumbnailPhoto)) && (
                    <div className="border-t border-border pt-4">
                      <Label>Дополнительные поля</Label>
                      <div className="space-y-2 mt-2">
                        {customFields.length === 0 ? (
                          <div className="text-xs text-muted-foreground">Нет дополнительных полей</div>
                        ) : (
                          <>
                            {customFields.map((field, index) => (
                              <div key={index} className="flex items-center space-x-2">
                                <Input value={field.key} disabled className="flex-1" />
                                <Input value={field.value} disabled className="flex-1" />
                              </div>
                            ))}
                          </>
                        )}
                        {/* Показываем thumbnailPhoto только в админ режиме */}
                        {(location.customFields as any)?.thumbnailPhoto && (
                          <div className="flex flex-col gap-1 mt-2">
                            <Label>thumbnailPhoto (base64)</Label>
                            <Textarea value={(location.customFields as any).thumbnailPhoto} disabled rows={2} className="text-xs" />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
              {/* Админ режим */}
              {isAdminMode && (
                <>
                  <div>
                    <Label htmlFor="name">{isSpecialType ? 'Название' : 'ФИО'}</Label>
                    <Input
                      id="name"
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      data-testid="input-location-name"
                    />
                  </div>
                  {!isSpecialType && (
                    <>
                      <div>
                        <Label htmlFor="position">Должность</Label>
                        <Input
                          id="position"
                          type="text"
                          value={formData.position}
                          onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                          data-testid="input-location-position"
                        />
                      </div>
                      <div>
                        <Label htmlFor="department">Отдел</Label>
                        <Input
                          id="department"
                          type="text"
                          value={formData.department}
                          onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                          data-testid="input-location-department"
                        />
                      </div>
                      <div>
                        <Label htmlFor="email">Почта</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          data-testid="input-location-email"
                        />
                      </div>
                      <div>
                        <Label htmlFor="telegram">Телеграмм</Label>
                        <Input
                          id="telegram"
                          type="text"
                          value={formData.telegram}
                          onChange={(e) => setFormData({ ...formData, telegram: e.target.value })}
                          data-testid="input-location-telegram"
                        />
                      </div>
                      <div>
                        <Label htmlFor="logonCount">Mattermost</Label>
                        <Input
                          id="logonCount"
                          type="text"
                          value={String(formData.logonCount ?? '')}
                          onChange={(e) => setFormData({ ...formData, logonCount: e.target.value ? Number(e.target.value) : undefined })}
                          data-testid="input-location-logonCount"
                        />
                      </div>
                    </>
                  )}
                  <div>
                    <Label htmlFor="type">Тип</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value) => setFormData({ ...formData, type: value })}
                    >
                      <SelectTrigger data-testid="select-location-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="meeting-room">Переговорная</SelectItem>
                        <SelectItem value="workstation">Рабочее место</SelectItem>
                        <SelectItem value="equipment">МФУ</SelectItem>
                        <SelectItem value="camera">Камера</SelectItem>
                        <SelectItem value="socket">Розетка</SelectItem>
                        <SelectItem value="common-area">Общая зона</SelectItem>
                        <SelectItem value="ac">Кондиционер</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="hidden">
                    <Label htmlFor="port">Port</Label>
                    <Input
                      id="port"
                      type="text"
                      value={formData.port}
                      onChange={(e) => setFormData({ ...formData, port: e.target.value, name: e.target.value })}
                      data-testid="input-location-port"
                    />
                  </div>
                  <div className="hidden">
                    <Label htmlFor="cisco-location">Cisco</Label>
                    <Select
                      value={formData.ciscoSite}
                      onValueChange={(value) => setFormData({ ...formData, ciscoSite: value })}
                    >
                      <SelectTrigger data-testid="select-cisco-location">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">Пятый этаж</SelectItem>
                        <SelectItem value="9">Девятый этаж</SelectItem>
                        <SelectItem value="MSK">Москва</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {formData.type !== 'socket' && (
                    <div>
                      <Label htmlFor="equipment">Оборудование</Label>
                      <Input
                        id="equipment"
                        type="text"
                        value={formData.equipment}
                        onChange={(e) => setFormData({ ...formData, equipment: e.target.value })}
                        data-testid="input-location-equipment"
                      />
                    </div>
                  )}

                  {formData.type !== 'socket' && (
                    <div>
                      <Label htmlFor="status">Статус</Label>
                      <Select
                        value={formData.status}
                        onValueChange={(value) => setFormData({ ...formData, status: value })}
                      >
                        <SelectTrigger data-testid="select-location-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="available">Доступно</SelectItem>
                          <SelectItem value="occupied">Занято</SelectItem>
                          <SelectItem value="maintenance">На обслуживании</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Выбор иконки для Общей зоны */}
                  {formData.type === 'common-area' && (
                    <div>
                      <Label htmlFor="icon-select">Иконка {customIcons.length > 0 && `(${customIcons.length})`}</Label>
                      {customIcons.length > 0 ? (
                        <Select
                          value={selectedIcon}
                          onValueChange={(value) => setSelectedIcon(value)}
                        >
                          <SelectTrigger id="icon-select">
                            <SelectValue placeholder="Выберите иконку" />
                          </SelectTrigger>
                          <SelectContent>
                            {customIcons.map((icon) => (
                              <SelectItem key={icon.name} value={icon.name}>
                                {icon.name.replace(/\.svg$/i, '')}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="text-sm text-muted-foreground p-2 border border-dashed rounded">
                          Загрузка иконок...
                        </div>
                      )}
                    </div>
                  )}

                  {/* Выбор иконки для Переговорной */}
                  {formData.type === 'meeting-room' && (
                    <div>
                      <Label htmlFor="meeting-room-icon-select">Иконка {meetingRoomIcons.length > 0 && `(${meetingRoomIcons.length})`}</Label>
                      {meetingRoomIcons.length > 0 ? (
                        <Select
                          value={selectedMeetingRoomIcon}
                          onValueChange={(value) => setSelectedMeetingRoomIcon(value)}
                        >
                          <SelectTrigger id="meeting-room-icon-select">
                            <SelectValue placeholder="Выберите иконку" />
                          </SelectTrigger>
                          <SelectContent>
                            {meetingRoomIcons.map((icon) => (
                              <SelectItem key={icon.name} value={icon.name}>
                                {icon.name.replace(/\.svg$/i, '')}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="text-sm text-muted-foreground p-2 border border-dashed rounded">
                          Загрузка иконок...
                        </div>
                      )}
                    </div>
                  )}

                  {/* Выбор иконки для МФУ */}
                  {formData.type === 'equipment' && (
                    <div>
                      <Label htmlFor="equipment-icon-select">Иконка {equipmentIcons.length > 0 && `(${equipmentIcons.length})`}</Label>
                      {equipmentIcons.length > 0 ? (
                        <Select
                          value={selectedEquipmentIcon}
                          onValueChange={(value) => setSelectedEquipmentIcon(value)}
                        >
                          <SelectTrigger id="equipment-icon-select">
                            <SelectValue placeholder="Выберите иконку" />
                          </SelectTrigger>
                          <SelectContent>
                            {equipmentIcons.map((icon) => (
                              <SelectItem key={icon.name} value={icon.name}>
                                {icon.name.replace(/\.svg$/i, '')}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="text-sm text-muted-foreground p-2 border border-dashed rounded">
                          Загрузка иконок...
                        </div>
                      )}
                    </div>
                  )}

                  {/* Выбор иконки для Камеры */}
                  {formData.type === 'camera' && (
                    <div>
                      <Label htmlFor="camera-icon-select">Иконка {cameraIcons.length > 0 && `(${cameraIcons.length})`}</Label>
                      {cameraIcons.length > 0 ? (
                        <Select
                          value={selectedCameraIcon}
                          onValueChange={(value) => setSelectedCameraIcon(value)}
                        >
                          <SelectTrigger id="camera-icon-select">
                            <SelectValue placeholder="Выберите иконку" />
                          </SelectTrigger>
                          <SelectContent>
                            {cameraIcons.map((icon) => (
                              <SelectItem key={icon.name} value={icon.name}>
                                {icon.name.replace(/\.svg$/i, '')}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="text-sm text-muted-foreground p-2 border border-dashed rounded">
                          Загрузка иконок...
                        </div>
                      )}
                    </div>
                  )}

                  {/* Выбор иконки для Кондиционера */}
                  {formData.type === 'ac' && (
                    <div>
                      <Label htmlFor="ac-icon-select">Иконка {acIcons.length > 0 && `(${acIcons.length})`}</Label>
                      {acIcons.length > 0 ? (
                        <Select
                          value={selectedAcIcon}
                          onValueChange={(value) => setSelectedAcIcon(value)}
                        >
                          <SelectTrigger id="ac-icon-select">
                            <SelectValue placeholder="Выберите иконку" />
                          </SelectTrigger>
                          <SelectContent>
                            {acIcons.map((icon) => (
                              <SelectItem key={icon.name} value={icon.name}>
                                {icon.name.replace(/\.svg$/i, '')}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="text-sm text-muted-foreground p-2 border border-dashed rounded">
                          Загрузка иконок...
                        </div>
                      )}
                    </div>
                  )}

                  {/* Выбор иконки для Рабочего места */}
                  {formData.type === 'workstation' && (
                    <div>
                      <Label htmlFor="workstation-icon-select">
                        Иконка для статуса "{formData.status === 'occupied' ? 'Занято' : formData.status === 'available' ? 'Доступно' : 'На обслуживании'}"
                      </Label>
                      {formData.status === 'occupied' && (
                        workstationActivIcons.length > 0 ? (
                          <Select
                            value={selectedWorkstationIcon}
                            onValueChange={(value) => setSelectedWorkstationIcon(value)}
                          >
                            <SelectTrigger id="workstation-icon-select">
                              <SelectValue placeholder="Выберите иконку" />
                            </SelectTrigger>
                            <SelectContent>
                              {workstationActivIcons.map((icon) => (
                                <SelectItem key={icon.name} value={icon.name}>
                                  {icon.name.replace(/\.svg$/i, '')}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="text-sm text-muted-foreground p-2 border border-dashed rounded">
                            Загрузка иконок...
                          </div>
                        )
                      )}
                      {formData.status === 'available' && (
                        workstationNonactivIcons.length > 0 ? (
                          <Select
                            value={selectedWorkstationIcon}
                            onValueChange={(value) => setSelectedWorkstationIcon(value)}
                          >
                            <SelectTrigger id="workstation-icon-select">
                              <SelectValue placeholder="Выберите иконку" />
                            </SelectTrigger>
                            <SelectContent>
                              {workstationNonactivIcons.map((icon) => (
                                <SelectItem key={icon.name} value={icon.name}>
                                  {icon.name.replace(/\.svg$/i, '')}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="text-sm text-muted-foreground p-2 border border-dashed rounded">
                            Загрузка иконок...
                          </div>
                        )
                      )}
                      {formData.status === 'maintenance' && (
                        workstationRepairIcons.length > 0 ? (
                          <Select
                            value={selectedWorkstationIcon}
                            onValueChange={(value) => setSelectedWorkstationIcon(value)}
                          >
                            <SelectTrigger id="workstation-icon-select">
                              <SelectValue placeholder="Выберите иконку" />
                            </SelectTrigger>
                            <SelectContent>
                              {workstationRepairIcons.map((icon) => (
                                <SelectItem key={icon.name} value={icon.name}>
                                  {icon.name.replace(/\.svg$/i, '')}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="text-sm text-muted-foreground p-2 border border-dashed rounded">
                            Загрузка иконок...
                          </div>
                        )
                      )}
                    </div>
                  )}

                  {/* Поля для розетки (если выбран тип socket) */}
                  {formData.type === 'socket' && (
                    <div className="space-y-2 pt-4 border-t border-border">
                      <Label>Параметры розетки</Label>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="port">Port</Label>
                        <Input id="port" type="text" value={formData.port} onChange={e => {
                          setFormData({ ...formData, port: e.target.value, name: e.target.value });
                        }} data-testid="input-location-port" />
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={async () => {
                            if (!formData.port) return toast({ title: 'Введите номер порта' });
                            await syncWithCisco(formData.port, false);
                          }} 
                          disabled={ciscoLoading}>
                          {ciscoLoading ? 'Загрузка...' : 'Синхронизировать с Cisco'}
                        </Button>
                      </div>
                      <div>
                        <Label htmlFor="cisco-location">Расположение</Label>
                        <Select
                          value={formData.ciscoSite}
                          onValueChange={(value) => setFormData({ ...formData, ciscoSite: value })}
                        >
                          <SelectTrigger data-testid="select-cisco-location">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="5">Пятый этаж</SelectItem>
                            <SelectItem value="9">Девятый этаж</SelectItem>
                            <SelectItem value="MSK">Москва</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="socket-name">Name</Label>
                        <Input id="socket-name" type="text" value={customFields.find(f => f.key === 'Name')?.value ?? ''} onChange={e => {
                          setCustomFields(prev => prev.map(f => f.key === 'Name' ? { ...f, value: e.target.value } : f));
                        }} data-testid="input-socket-name" />
                      </div>
                      <div>
                        <Label htmlFor="socket-status">Status</Label>
                        <Input id="socket-status" type="text" value={customFields.find(f => f.key === 'Status')?.value ?? ''} onChange={e => {
                          setCustomFields(prev => prev.map(f => f.key === 'Status' ? { ...f, value: e.target.value } : f));
                        }} data-testid="input-socket-status" />
                      </div>
                      <div>
                        <Label htmlFor="socket-vlan">Vlan</Label>
                        <Input id="socket-vlan" type="text" value={customFields.find(f => f.key === 'Vlan')?.value ?? ''} onChange={e => {
                          setCustomFields(prev => prev.map(f => f.key === 'Vlan' ? { ...f, value: e.target.value } : f));
                        }} data-testid="input-socket-vlan" />
                      </div>
                      <div>
                        <Label htmlFor="socket-duplex">Duplex</Label>
                        <Input id="socket-duplex" type="text" value={customFields.find(f => f.key === 'Duplex')?.value ?? ''} onChange={e => {
                          setCustomFields(prev => prev.map(f => f.key === 'Duplex' ? { ...f, value: e.target.value } : f));
                        }} data-testid="input-socket-duplex" />
                      </div>
                      <div>
                        <Label htmlFor="socket-speed">Speed</Label>
                        <Input id="socket-speed" type="text" value={customFields.find(f => f.key === 'Speed')?.value ?? ''} onChange={e => {
                          setCustomFields(prev => prev.map(f => f.key === 'Speed' ? { ...f, value: e.target.value } : f));
                        }} data-testid="input-socket-speed" />
                      </div>
                      <div>
                        <Label htmlFor="socket-type">Type</Label>
                        <Input id="socket-type" type="text" value={customFields.find(f => f.key === 'Type')?.value ?? ''} onChange={e => {
                          setCustomFields(prev => prev.map(f => f.key === 'Type' ? { ...f, value: e.target.value } : f));
                        }} data-testid="input-socket-type" />
                      </div>
                    </div>
                  )}

                  {/* Дополнительные поля - показываем только если это не розетка */}
                  {formData.type !== 'socket' && (
                    <div className="border-t border-border pt-4">
                      <Label>Дополнительные поля</Label>
                      <div className="space-y-2 mt-2">
                        {customFields.map((field, index) => (
                          <div key={index} className="flex items-center space-x-2">
                            <Input value={field.key} onChange={e => updateCustomField(index, 'key', e.target.value)} className="flex-1" />
                            <Input value={field.value} onChange={e => updateCustomField(index, 'value', e.target.value)} className="flex-1" />
                            <Button variant="destructive" size="sm" onClick={() => removeCustomField(index)}><Trash2 className="w-3 h-3" /></Button>
                          </div>
                        ))}
                        <Button variant="outline" size="sm" onClick={addCustomField}><Plus className="w-3 h-3 mr-1" />Добавить поле</Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            
            {/* Action Buttons */}
            {isAdminMode && (
              <div className="flex justify-end gap-2 pt-6 border-t border-border">
                {!isHr && (
                  <Button 
                    variant="destructive" 
                    onClick={handleDelete}
                    data-testid="button-delete-location"
                    className="mr-auto ml-2"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Удалить
                  </Button>
                )}
                <Button 
                    onClick={handleSave}
                    data-testid="button-save-location"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Сохранить изменения
                  </Button>
              </div>
            )}

            {!isAdminMode && (
              <div className="pt-6 border-t border-border">
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (onFindLocation) onFindLocation(location.id);
                    onClose();
                  }}
                  className="w-full"
                  data-testid="button-find-me"
                >
                  Найти меня
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

export default LocationModal;
