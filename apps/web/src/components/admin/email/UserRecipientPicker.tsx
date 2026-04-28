'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { adminApi } from '@/lib/api';
import { LoadingLines, StatusBadge } from '@/components/ui/signal-primitives';

export type SelectedUser = {
  id: string;
  email: string;
  name: string | null;
  phone?: string | null;
};

export type UserRecipientPickerProps = {
  selectedUsers: SelectedUser[];
  onChange: (users: SelectedUser[]) => void;
  eventId?: string;
  maxUsers?: number;
  disabled?: boolean;
};

export function UserRecipientPicker({
  selectedUsers,
  onChange,
  eventId,
  maxUsers = 500,
  disabled = false,
}: UserRecipientPickerProps) {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SelectedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const searchUsers = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSearchResults([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      const result = await adminApi.searchUsers({
        q: q.trim(),
        eventId,
        limit: 20,
      });
      setSearchResults(result.users.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name || null,
        phone: u.phone || null,
      })));
    } catch {
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      void searchUsers(query);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, searchUsers]);

  const isSelected = (userId: string) =>
    selectedUsers.some(u => u.id === userId);

  const handleToggle = (user: SelectedUser) => {
    if (disabled) return;

    if (isSelected(user.id)) {
      onChange(selectedUsers.filter(u => u.id !== user.id));
    } else {
      if (selectedUsers.length >= maxUsers) return;
      onChange([...selectedUsers, user]);
    }
  };

  const handleRemove = (userId: string) => {
    if (disabled) return;
    onChange(selectedUsers.filter(u => u.id !== userId));
  };

  const handleSelectAll = () => {
    if (disabled) return;
    const newUsers = searchResults.filter(u => !isSelected(u.id));
    const availableSlots = maxUsers - selectedUsers.length;
    onChange([...selectedUsers, ...newUsers.slice(0, availableSlots)]);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Поиск получателей
        </label>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по email, ФИО, телефону..."
          disabled={disabled}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
      </div>

      {loading && (
        <div className="py-4">
          <LoadingLines />
        </div>
      )}

      {searched && !loading && searchResults.length === 0 && (
        <p className="text-sm text-gray-500 py-4 text-center">
          Пользователи не найдены
        </p>
      )}

      {searchResults.length > 0 && (
        <div className="border border-gray-200 rounded-lg divide-y divide-gray-200">
          <div className="px-3 py-2 bg-gray-50 flex items-center justify-between">
            <span className="text-sm text-gray-600">
              Найдено: {searchResults.length}
            </span>
            <button
              type="button"
              onClick={handleSelectAll}
              disabled={disabled || selectedUsers.length >= maxUsers}
              className="text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              Выбрать всех
            </button>
          </div>
          {searchResults.map(user => (
            <div
              key={user.id}
              className="px-3 py-2 flex items-center gap-3 hover:bg-gray-50 cursor-pointer"
              onClick={() => handleToggle(user)}
            >
              <input
                type="checkbox"
                checked={isSelected(user.id)}
                onChange={() => handleToggle(user)}
                disabled={disabled || (!isSelected(user.id) && selectedUsers.length >= maxUsers)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {user.name || 'Без имени'}
                  </span>
                  {user.email && (
                    <span className="text-sm text-gray-500 truncate">
                      {user.email}
                    </span>
                  )}
                </div>
                {user.phone && (
                  <span className="text-xs text-gray-400">
                    {user.phone}
                  </span>
                )}
              </div>
              {isSelected(user.id) && (
                <StatusBadge tone="success">
                  Выбран
                </StatusBadge>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedUsers.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">
              Выбрано получателей: {selectedUsers.length}
              {maxUsers < 500 && (
                <span className="text-gray-400 ml-1">
                  / {maxUsers}
                </span>
              )}
            </label>
            <button
              type="button"
              onClick={() => onChange([])}
              disabled={disabled}
              className="text-sm text-red-600 hover:text-red-800 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              Очистить всё
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedUsers.map(user => (
              <div
                key={user.id}
                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-sm"
              >
                <span className="max-w-[200px] truncate">
                  {user.name || user.email}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemove(user.id)}
                  disabled={disabled}
                  className="text-blue-500 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                  aria-label={`Удалить ${user.name || user.email}`}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
