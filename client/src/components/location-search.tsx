import { useState, useMemo, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Location } from "@shared/schema";

interface LocationSearchProps {
  locations: Location[];
  onFind: (locationId: string) => void;
  onLocationsFiltered: (locations: Location[]) => void;
}

export default function LocationSearch({ locations, onFind, onLocationsFiltered }: LocationSearchProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const filteredLocations = useMemo(() => {
    if (!searchValue.trim()) return locations;
    const q = searchValue.trim().toLowerCase();
    return locations.filter(l => {
      const name = (l.name || "").toLowerCase();
      // department может храниться в customFields
      const department = ((l.customFields as Record<string, any>)?.department || "").toString().toLowerCase();
      return name.includes(q) || department.includes(q);
    });
  }, [locations, searchValue]);

  // Уведомляем родителя об изменении отфильтрованных локаций,
  // но только если результаты действительно поменялись (чтобы избежать лишних вызовов)
  const prevKeyRef = useRef<string | null>(null);
  const makeKey = (arr: Location[]) => `${arr.length}:${arr.map(a => a.id).join('|')}`;

  const notifyIfChanged = (arr: Location[]) => {
    try {
      const key = makeKey(arr);
      if (prevKeyRef.current !== key) {
        prevKeyRef.current = key;
        onLocationsFiltered(arr);
      }
    } catch (e) {
      // fallback: если что-то пошло не так — просто уведомим
      onLocationsFiltered(arr);
    }
  };

  useEffect(() => {
    // Если поиск закрыт - показываем все локации
    if (!searchOpen) {
      notifyIfChanged(locations);
      return;
    }
    notifyIfChanged(filteredLocations);
  }, [filteredLocations, locations, searchOpen, onLocationsFiltered]);

  // Фокусируем input при открытии поиска без скролла страницы
  useEffect(() => {
    if (searchOpen && inputRef.current) {
      try {
        inputRef.current.focus({ preventScroll: true });
      } catch (e) {
        // fallback для браузеров, которые не поддерживают опцию
        inputRef.current.focus();
      }
    }
  }, [searchOpen]);

  // Закрытие по клику вне области
  useEffect(() => {
    function onDocClick(e: MouseEvent | TouchEvent) {
      if (!searchOpen) return;
      const target = e.target as Node | null;
      if (rootRef.current && target && !rootRef.current.contains(target)) {
        setSearchOpen(false);
        setSearchValue("");
        notifyIfChanged(locations); // Сбрасываем фильтр при закрытии (только если изменилось)
      }
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('touchstart', onDocClick);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('touchstart', onDocClick);
    };
  }, [searchOpen]);

  return (
  <div ref={rootRef}>
      {!searchOpen ? (
        <Button size="sm" variant="outline" onClick={() => setSearchOpen(true)} data-testid="button-open-search">
          Поиск локации
        </Button>
      ) : (
        <div className="flex flex-col gap-1 items-stretch bg-white/80 dark:bg-slate-900/80 rounded-lg p-2 shadow min-w-[260px]">
          <div className="flex gap-2 items-center">
            <Input
              value={searchValue}
              onChange={e => setSearchValue(e.target.value)}
              placeholder="ФИО или название..."
              className="w-48"
              ref={inputRef}
              data-testid="input-location-search"
              onKeyDown={e => {
                if (e.key === 'Enter' && filteredLocations.length > 0) {
                  onFind(filteredLocations[0].id);
                }
              }}
            />
            <Button
              size="sm"
              variant="default"
              onClick={() => {
                if (filteredLocations.length > 0) onFind(filteredLocations[0].id);
              }}
              disabled={!searchValue || filteredLocations.length === 0}
              data-testid="button-find-location"
            >
              Найти
            </Button>
            {searchValue && (
              <Button size="sm" variant="ghost" onClick={() => setSearchValue("")} data-testid="button-clear-search">✕</Button>
            )}
          </div>
          {/* Список подсказок */}
          {searchValue && filteredLocations.length > 0 && (
            <div className="mt-1 bg-white dark:bg-slate-900 border border-border rounded shadow max-h-48 overflow-auto z-30">
              {filteredLocations.slice(0, 5).map(loc => (
                <div
                  key={loc.id}
                  className="px-3 py-1.5 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900 text-sm truncate"
                  onClick={() => onFind(loc.id)}
                  data-testid={`search-suggestion-${loc.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="truncate">{loc.name}</div>
                    {
                      ((loc.customFields as Record<string, any>)?.department) && (
                        <div className="ml-2 text-xs text-muted-foreground truncate">{(loc.customFields as Record<string, any>).department}</div>
                      )
                    }
                  </div>
                </div>
              ))}
            </div>
          )}
          {searchValue && filteredLocations.length === 0 && (
            <div className="mt-1 px-3 py-1.5 text-muted-foreground text-sm">Нет совпадений</div>
          )}
        </div>
      )}
    </div>
  );
}

