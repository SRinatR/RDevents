UPDATE "events"
SET "requiredProfileFields" = array_remove(array_remove("requiredProfileFields", 'consentPersonalData'), 'consentClientRules');
