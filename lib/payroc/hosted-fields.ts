export const HOSTED_FIELDS_CONFIG = {
  uat: {
    url: "https://cdn.uat.payroc.com/js/hosted-fields/hosted-fields-1.7.0.261457.js",
    integrityHash:
      "sha384-m1A0nfFYa8sAfpDN0d60o4ztd/aCPC2xDVaOT31Urrmn4xypfHqgHQMayZeIK1PM",
  },
  production: {
    url: "https://cdn.payroc.com/js/hosted-fields/hosted-fields-1.7.0.261457.js",
    integrityHash:
      "sha384-m1A0nfFYa8sAfpDN0d60o4ztd/aCPC2xDVaOT31Urrmn4xypfHqgHQMayZeIK1PM",
  },
};

export function getHostedFieldsConfig() {
  const env = process.env.PAYROC_ENV === "uat" ? "uat" : "production";
  return HOSTED_FIELDS_CONFIG[env];
}
