CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');
CREATE TYPE "IdentityDocumentType" AS ENUM ('PASSPORT', 'ID_CARD', 'RESIDENCE_PERMIT', 'OTHER');
CREATE TYPE "ActivityStatus" AS ENUM ('SCHOOL_STUDENT', 'COLLEGE_STUDENT', 'UNIVERSITY_STUDENT', 'EMPLOYED', 'UNEMPLOYED');
CREATE TYPE "LanguageLevel" AS ENUM ('A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'NATIVE');
CREATE TYPE "ActivityDirection" AS ENUM ('SCIENCE_EDUCATION', 'PUBLIC_ADMINISTRATION_LAW', 'MEDIA', 'CREATIVE_INDUSTRIES', 'ENTREPRENEURSHIP', 'SPORT_HEALTHCARE', 'AGRICULTURE_AGROTECH', 'DIGITALIZATION_IT', 'TOURISM_HOSPITALITY', 'ECOLOGY', 'CIVIL_SOCIETY', 'ARCHITECTURE_CONSTRUCTION', 'ECONOMICS_FINANCE', 'INDUSTRY_TECHNOLOGY_ENGINEERING', 'OTHER');
CREATE TYPE "AdditionalDocumentType" AS ENUM ('SCHOOL_PROOF', 'STUDENT_PROOF', 'BIRTH_CERTIFICATE');

ALTER TABLE "users"
  ADD COLUMN "hasNoLastName" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "hasNoFirstName" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "hasNoMiddleName" BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE "reference_countries" (
  "code" TEXT NOT NULL,
  "nameRu" TEXT NOT NULL,
  "nameEn" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reference_countries_pkey" PRIMARY KEY ("code")
);

CREATE TABLE "reference_uz_regions" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "nameRu" TEXT NOT NULL,
  "nameEn" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT "reference_uz_regions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reference_uz_districts" (
  "id" TEXT NOT NULL,
  "regionId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "nameRu" TEXT NOT NULL,
  "nameEn" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT "reference_uz_districts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reference_uz_settlements" (
  "id" TEXT NOT NULL,
  "districtId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "nameRu" TEXT NOT NULL,
  "nameEn" TEXT NOT NULL,
  "type" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT "reference_uz_settlements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_extended_profiles" (
  "userId" TEXT NOT NULL,
  "gender" "Gender",
  "citizenshipCountryCode" TEXT,
  "residenceCountryCode" TEXT,
  "regionId" TEXT,
  "districtId" TEXT,
  "settlementId" TEXT,
  "regionText" TEXT,
  "districtText" TEXT,
  "settlementText" TEXT,
  "street" TEXT,
  "house" TEXT,
  "apartment" TEXT,
  "postalCode" TEXT,
  "consentMailing" BOOLEAN NOT NULL DEFAULT FALSE,
  "consentMailingAt" TIMESTAMP(3),
  "activityStatus" "ActivityStatus",
  "studiesInRussia" BOOLEAN NOT NULL DEFAULT FALSE,
  "organizationName" TEXT,
  "facultyOrDepartment" TEXT,
  "classCourseYear" TEXT,
  "positionTitle" TEXT,
  "achievementsText" TEXT,
  "englishLevel" "LanguageLevel",
  "russianLevel" "LanguageLevel",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_extended_profiles_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "user_identity_documents" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "documentType" "IdentityDocumentType",
  "citizenshipCountryCode" TEXT,
  "documentSeries" TEXT,
  "documentNumber" TEXT,
  "issueDate" TIMESTAMP(3),
  "issuedBy" TEXT,
  "issueCountryCode" TEXT,
  "expiryDate" TIMESTAMP(3),
  "placeOfBirth" TEXT,
  "pinfl" TEXT,
  "passportSeries" TEXT,
  "passportNumber" TEXT,
  "subdivisionCode" TEXT,
  "snils" TEXT,
  "hasSecondCitizenship" BOOLEAN NOT NULL DEFAULT FALSE,
  "secondCitizenshipCountryCode" TEXT,
  "scanAssetId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_identity_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_international_passports" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "countryCode" TEXT,
  "series" TEXT,
  "number" TEXT,
  "issueDate" TIMESTAMP(3),
  "expiryDate" TIMESTAMP(3),
  "issuedBy" TEXT,
  "scanAssetId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_international_passports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_social_links" (
  "userId" TEXT NOT NULL,
  "maxUrl" TEXT,
  "maxAbsent" BOOLEAN NOT NULL DEFAULT FALSE,
  "vkUrl" TEXT,
  "vkAbsent" BOOLEAN NOT NULL DEFAULT FALSE,
  "telegramUrl" TEXT,
  "telegramAbsent" BOOLEAN NOT NULL DEFAULT FALSE,
  "instagramUrl" TEXT,
  "instagramAbsent" BOOLEAN NOT NULL DEFAULT FALSE,
  "facebookUrl" TEXT,
  "facebookAbsent" BOOLEAN NOT NULL DEFAULT FALSE,
  "xUrl" TEXT,
  "xAbsent" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_social_links_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "user_activity_directions" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "direction" "ActivityDirection" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_activity_directions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_additional_languages" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "languageName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_additional_languages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_additional_documents" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "AdditionalDocumentType" NOT NULL,
  "assetId" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_additional_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_emergency_contacts" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "fullName" TEXT,
  "relationship" TEXT,
  "phone" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_emergency_contacts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "reference_uz_regions_code_key" ON "reference_uz_regions"("code");
CREATE UNIQUE INDEX "reference_uz_districts_code_key" ON "reference_uz_districts"("code");
CREATE INDEX "reference_uz_districts_regionId_idx" ON "reference_uz_districts"("regionId");
CREATE UNIQUE INDEX "reference_uz_settlements_code_key" ON "reference_uz_settlements"("code");
CREATE INDEX "reference_uz_settlements_districtId_idx" ON "reference_uz_settlements"("districtId");
CREATE UNIQUE INDEX "user_identity_documents_userId_key" ON "user_identity_documents"("userId");
CREATE UNIQUE INDEX "user_identity_documents_scanAssetId_key" ON "user_identity_documents"("scanAssetId");
CREATE UNIQUE INDEX "user_international_passports_userId_key" ON "user_international_passports"("userId");
CREATE UNIQUE INDEX "user_international_passports_scanAssetId_key" ON "user_international_passports"("scanAssetId");
CREATE UNIQUE INDEX "user_activity_directions_userId_direction_key" ON "user_activity_directions"("userId", "direction");
CREATE INDEX "user_activity_directions_userId_idx" ON "user_activity_directions"("userId");
CREATE UNIQUE INDEX "user_additional_languages_userId_languageName_key" ON "user_additional_languages"("userId", "languageName");
CREATE INDEX "user_additional_languages_userId_idx" ON "user_additional_languages"("userId");
CREATE UNIQUE INDEX "user_additional_documents_assetId_key" ON "user_additional_documents"("assetId");
CREATE UNIQUE INDEX "user_additional_documents_userId_type_key" ON "user_additional_documents"("userId", "type");
CREATE INDEX "user_additional_documents_userId_idx" ON "user_additional_documents"("userId");
CREATE UNIQUE INDEX "user_emergency_contacts_userId_key" ON "user_emergency_contacts"("userId");

ALTER TABLE "reference_uz_districts" ADD CONSTRAINT "reference_uz_districts_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "reference_uz_regions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reference_uz_settlements" ADD CONSTRAINT "reference_uz_settlements_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "reference_uz_districts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_extended_profiles" ADD CONSTRAINT "user_extended_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_extended_profiles" ADD CONSTRAINT "user_extended_profiles_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "reference_uz_regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "user_extended_profiles" ADD CONSTRAINT "user_extended_profiles_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "reference_uz_districts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "user_extended_profiles" ADD CONSTRAINT "user_extended_profiles_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "reference_uz_settlements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "user_identity_documents" ADD CONSTRAINT "user_identity_documents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_identity_documents" ADD CONSTRAINT "user_identity_documents_scanAssetId_fkey" FOREIGN KEY ("scanAssetId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "user_international_passports" ADD CONSTRAINT "user_international_passports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_international_passports" ADD CONSTRAINT "user_international_passports_scanAssetId_fkey" FOREIGN KEY ("scanAssetId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "user_social_links" ADD CONSTRAINT "user_social_links_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_activity_directions" ADD CONSTRAINT "user_activity_directions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_additional_languages" ADD CONSTRAINT "user_additional_languages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_additional_documents" ADD CONSTRAINT "user_additional_documents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_additional_documents" ADD CONSTRAINT "user_additional_documents_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_emergency_contacts" ADD CONSTRAINT "user_emergency_contacts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "reference_countries" ("code", "nameRu", "nameEn") VALUES
  ('UZ', 'Узбекистан', 'Uzbekistan'),
  ('RU', 'Россия', 'Russia'),
  ('KZ', 'Казахстан', 'Kazakhstan'),
  ('KG', 'Кыргызстан', 'Kyrgyzstan'),
  ('TJ', 'Таджикистан', 'Tajikistan'),
  ('TM', 'Туркменистан', 'Turkmenistan'),
  ('BY', 'Беларусь', 'Belarus'),
  ('OTHER', 'Другая страна', 'Other country')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "reference_uz_regions" ("id", "code", "nameRu", "nameEn", "sortOrder") VALUES
  ('reg_tashkent_city', 'TASHKENT_CITY', 'г. Ташкент', 'Tashkent city', 10),
  ('reg_tashkent_region', 'TASHKENT_REGION', 'Ташкентская область', 'Tashkent region', 20),
  ('reg_samarkand', 'SAMARKAND', 'Самаркандская область', 'Samarkand region', 30)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "reference_uz_districts" ("id", "regionId", "code", "nameRu", "nameEn", "sortOrder") VALUES
  ('dist_yunusabad', 'reg_tashkent_city', 'YUNUSABAD', 'Юнусабадский район', 'Yunusabad district', 10),
  ('dist_mirzo_ulugbek', 'reg_tashkent_city', 'MIRZO_ULUGBEK', 'Мирзо-Улугбекский район', 'Mirzo Ulugbek district', 20),
  ('dist_chilanzar', 'reg_tashkent_city', 'CHILANZAR', 'Чиланзарский район', 'Chilanzar district', 30),
  ('dist_samarkand_city', 'reg_samarkand', 'SAMARKAND_CITY', 'г. Самарканд', 'Samarkand city', 10)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "reference_uz_settlements" ("id", "districtId", "code", "nameRu", "nameEn", "type", "sortOrder") VALUES
  ('set_yunusabad_1', 'dist_yunusabad', 'YUNUSABAD_1', 'Юнусабад', 'Yunusabad', 'city_area', 10),
  ('set_mirzo_ulugbek_1', 'dist_mirzo_ulugbek', 'MIRZO_ULUGBEK_1', 'Мирзо-Улугбек', 'Mirzo Ulugbek', 'city_area', 10),
  ('set_chilanzar_1', 'dist_chilanzar', 'CHILANZAR_1', 'Чиланзар', 'Chilanzar', 'city_area', 10),
  ('set_samarkand_city_1', 'dist_samarkand_city', 'SAMARKAND_CITY_1', 'Самарканд', 'Samarkand', 'city', 10)
ON CONFLICT ("code") DO NOTHING;
