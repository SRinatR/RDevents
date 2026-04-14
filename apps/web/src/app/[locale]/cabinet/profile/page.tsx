'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../../hooks/useAuth';
import { useRouteLocale } from '../../../../hooks/useRouteParams';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function ProfilePage() {
  const { user, loading, updateProfile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useRouteLocale();
  const [activeTab, setActiveTab] = useState('registration');
  const requiredParam = searchParams.get('required') ?? '';
  const requiredFields = requiredParam.split(',').map(field => field.trim()).filter(Boolean);
  const requiredEventTitle = searchParams.get('event') ?? '';

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const [email, setEmail] = useState('');
  const [surnameRu, setSurnameRu] = useState('');
  const [surnameEn, setSurnameEn] = useState('');
  const [nameRu, setNameRu] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [patronymicRu, setPatronymicRu] = useState('');
  const [patronymicEn, setPatronymicEn] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState('');

  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [telegram, setTelegram] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bio, setBio] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push(`/${locale}/login`);
    if (user) {
      setEmail(user.email ?? '');
      setNameRu(user.name ?? '');
      setCity(user.city ?? '');
      setPhone(user.phone ?? '');
      setTelegram(user.telegram ?? '');
      setAvatarUrl(user.avatarUrl ?? '');
      setBirthDate(user.birthDate ? formatDateForProfile(user.birthDate) : '');
      setBio(user.bio ?? '');
    }
  }, [user, loading, router, locale]);

  useEffect(() => {
    if (requiredFields.some(field => ['avatarUrl', 'bio', 'birthDate', 'city', 'telegram'].includes(field))) {
      setActiveTab('general');
    } else if (requiredFields.length > 0) {
      setActiveTab('registration');
    }
  }, [requiredParam]);

  if (loading || !user) return null;

  async function handleSave(e?: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>) {
    e?.preventDefault();
    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      await updateProfile({
        name: nameRu,
        bio,
        city,
        phone,
        telegram,
        avatarUrl,
        birthDate: toApiBirthDate(birthDate),
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  }

  const isRequired = (field: string) => requiredFields.includes(field);
  const requiredInputClass = (field: string) => isRequired(field)
    ? 'border-[#E55C94] bg-[#FCF1F5] focus-visible:ring-[#E55C94]'
    : 'border-gray-200';
  const requiredHint = (field: string) => {
    if (!isRequired(field)) return null;
    return (
      <p className="mt-2 text-sm font-semibold text-[#E55C94]">
        {locale === 'ru'
          ? `Это поле обязательно для участия${requiredEventTitle ? ` в мероприятии "${requiredEventTitle}"` : ''}.`
          : `This field is required${requiredEventTitle ? ` for "${requiredEventTitle}"` : ''}.`}
      </p>
    );
  };

  return (
    <div className="bg-white rounded-2xl p-8 shadow-sm">
      <h1 className="text-3xl font-bold mb-8 text-[#1a1a1a]">
        {locale === 'ru' ? 'Профиль' : 'Profile'}
      </h1>

      {requiredFields.length > 0 && (
        <div className="mb-6 rounded-xl border border-[#E55C94]/30 bg-[#FCF1F5] p-4 text-sm font-semibold text-[#E55C94]">
          {locale === 'ru'
            ? `Чтобы участвовать${requiredEventTitle ? ` в "${requiredEventTitle}"` : ''}, заполните обязательные поля: ${requiredFields.join(', ')}.`
            : `To apply${requiredEventTitle ? ` for "${requiredEventTitle}"` : ''}, fill in the required fields: ${requiredFields.join(', ')}.`}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 mb-8 bg-transparent border-b rounded-none h-auto p-0">
          <TabsTrigger
            value="registration"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#E55C94] data-[state=active]:text-[#E55C94] data-[state=active]:bg-transparent pb-4 font-medium text-sm whitespace-nowrap"
          >
            {locale === 'ru' ? 'Регистрационные данные' : 'Registration Data'}
          </TabsTrigger>
          <TabsTrigger
            value="general"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#E55C94] data-[state=active]:text-[#E55C94] data-[state=active]:bg-transparent pb-4 font-medium text-sm whitespace-nowrap"
          >
            {locale === 'ru' ? 'Общие данные' : 'General Data'}
          </TabsTrigger>
          <TabsTrigger
            value="documents"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#E55C94] data-[state=active]:text-[#E55C94] data-[state=active]:bg-transparent pb-4 font-medium text-sm whitespace-nowrap"
          >
            {locale === 'ru' ? 'Личные документы' : 'Personal Documents'}
          </TabsTrigger>
          <TabsTrigger
            value="contacts"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#E55C94] data-[state=active]:text-[#E55C94] data-[state=active]:bg-transparent pb-4 font-medium text-sm whitespace-nowrap"
          >
            {locale === 'ru' ? 'Контактные данные' : 'Contact Data'}
          </TabsTrigger>
          <TabsTrigger
            value="activity"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#E55C94] data-[state=active]:text-[#E55C94] data-[state=active]:bg-transparent pb-4 font-medium text-sm whitespace-nowrap"
          >
            {locale === 'ru' ? 'Сфера деятельности' : 'Activity Sphere'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="registration" className="mt-8">
          <form className="space-y-6 max-w-4xl" onSubmit={handleSave}>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email <span className="text-red-500">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                disabled
                className="bg-gray-100 border-gray-200"
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="surnameRu" className="text-sm font-medium">
                  {locale === 'ru' ? 'Фамилия на русском' : 'Surname in Russian'} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="surnameRu"
                  value={surnameRu}
                  onChange={(e) => setSurnameRu(e.target.value)}
                  className="border-gray-200"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="surnameEn" className="text-sm font-medium">
                  {locale === 'ru' ? 'Фамилия на английском' : 'Surname in English'} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="surnameEn"
                  value={surnameEn}
                  onChange={(e) => setSurnameEn(e.target.value)}
                  className="border-gray-200"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox id="noSurname" />
              <Label htmlFor="noSurname" className="text-sm font-normal cursor-pointer">
                {locale === 'ru' ? 'Нет фамилии' : 'No surname'}
              </Label>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="nameRu" className="text-sm font-medium">
                  {locale === 'ru' ? 'Имя на русском' : 'Name in Russian'} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="nameRu"
                  value={nameRu}
                  onChange={(e) => setNameRu(e.target.value)}
                  className={requiredInputClass('name')}
                />
                {requiredHint('name')}
              </div>
              <div className="space-y-2">
                <Label htmlFor="nameEn" className="text-sm font-medium">
                  {locale === 'ru' ? 'Имя на английском' : 'Name in English'} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="nameEn"
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  className="border-gray-200"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="patronymicRu" className="text-sm font-medium">
                  {locale === 'ru' ? 'Отчество на русском' : 'Patronymic in Russian'}
                </Label>
                <Input
                  id="patronymicRu"
                  value={patronymicRu}
                  onChange={(e) => setPatronymicRu(e.target.value)}
                  className="border-gray-200"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="patronymicEn" className="text-sm font-medium">
                  {locale === 'ru' ? 'Отчество на английском' : 'Patronymic in English'}
                </Label>
                <Input
                  id="patronymicEn"
                  value={patronymicEn}
                  onChange={(e) => setPatronymicEn(e.target.value)}
                  className="border-gray-200"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="birthDate" className="text-sm font-medium">
                  {locale === 'ru' ? 'Дата рождения' : 'Birth Date'} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="birthDate"
                  type="text"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className={requiredInputClass('birthDate')}
                  placeholder={locale === 'ru' ? 'ДД.ММ.ГГГГ' : 'DD.MM.YYYY'}
                />
                {requiredHint('birthDate')}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-medium">
                  {locale === 'ru' ? 'Номер телефона' : 'Phone Number'} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={requiredInputClass('phone')}
                />
                {requiredHint('phone')}
              </div>
            </div>

            {error && (
              <div className="p-4 rounded-lg bg-red-50 text-red-600 text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="p-4 rounded-lg bg-green-50 text-green-600 text-sm font-medium">
                ✓ {locale === 'ru' ? 'Профиль успешно обновлён!' : 'Profile updated successfully!'}
              </div>
            )}

            <Button
              type="submit"
              disabled={saving}
              className="bg-gradient-to-r from-[#E84393] to-[#E55C94] hover:opacity-90 text-white font-bold px-8"
            >
              {saving ? (locale === 'ru' ? 'Сохранение...' : 'Saving...') : (locale === 'ru' ? 'Сохранить' : 'Save')}
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="general" className="mt-8">
          <div className="space-y-6 max-w-4xl">
            <div className="space-y-2">
              <Label htmlFor="city" className="text-sm font-medium">
                {locale === 'ru' ? 'Город' : 'City'}
              </Label>
              <Input
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className={requiredInputClass('city')}
              />
              {requiredHint('city')}
            </div>
            <div className="space-y-2">
              <Label htmlFor="country" className="text-sm font-medium">
                {locale === 'ru' ? 'Страна' : 'Country'}
              </Label>
              <Input
                id="country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="border-gray-200"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="avatarUrl" className="text-sm font-medium">
                {locale === 'ru' ? 'Ссылка на фото' : 'Photo URL'}
              </Label>
              <Input
                id="avatarUrl"
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                className={requiredInputClass('avatarUrl')}
                placeholder="https://..."
              />
              {requiredHint('avatarUrl')}
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio" className="text-sm font-medium">
                {locale === 'ru' ? 'О себе' : 'About Me'}
              </Label>
              <textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className={`w-full min-h-[120px] p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#E55C94] focus:border-transparent ${requiredInputClass('bio')}`}
                placeholder={locale === 'ru' ? 'Расскажите о себе...' : 'Tell us about yourself...'}
              />
              {requiredHint('bio')}
            </div>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-gradient-to-r from-[#E84393] to-[#E55C94] hover:opacity-90 text-white font-bold px-8"
            >
              {saving ? (locale === 'ru' ? 'Сохранение...' : 'Saving...') : (locale === 'ru' ? 'Сохранить' : 'Save')}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="documents" className="mt-8">
          <div className="space-y-6 max-w-4xl">
            <div className="bg-[#FAF8F7] rounded-xl p-6">
              <h3 className="font-semibold mb-4 text-[#1a1a1a]">
                {locale === 'ru' ? 'Загруженные документы' : 'Uploaded Documents'}
              </h3>
              <p className="text-gray-600 text-sm">
                {locale === 'ru' ? 'Документы появятся после одобрения заявки на мероприятие' : 'Documents will appear after your event application is approved'}
              </p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="contacts" className="mt-8">
          <div className="space-y-6 max-w-4xl">
            <div className="space-y-2">
              <Label htmlFor="telegram" className="text-sm font-medium">
                Telegram
              </Label>
              <Input
                id="telegram"
                value={telegram}
                onChange={(e) => setTelegram(e.target.value)}
                className={requiredInputClass('telegram')}
                placeholder="@username"
              />
              {requiredHint('telegram')}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phoneContact" className="text-sm font-medium">
                {locale === 'ru' ? 'Телефон' : 'Phone'}
              </Label>
              <Input
                id="phoneContact"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="border-gray-200"
              />
            </div>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-gradient-to-r from-[#E84393] to-[#E55C94] hover:opacity-90 text-white font-bold px-8"
            >
              {saving ? (locale === 'ru' ? 'Сохранение...' : 'Saving...') : (locale === 'ru' ? 'Сохранить' : 'Save')}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="mt-8">
          <div className="space-y-6 max-w-4xl">
            <div className="bg-[#FAF8F7] rounded-xl p-6">
              <h3 className="font-semibold mb-4 text-[#1a1a1a]">
                {locale === 'ru' ? 'Ваша деятельность' : 'Your Activity'}
              </h3>
              <p className="text-gray-600 text-sm">
                {locale === 'ru' ? 'Информация о вашей профессиональной деятельности и интересах' : 'Information about your professional activity and interests'}
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function formatDateForProfile(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ru-RU');
}

function toApiBirthDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const parts = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (parts) {
    const [, day, month, year] = parts;
    return new Date(`${year}-${month}-${day}T00:00:00.000Z`).toISOString();
  }

  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}
