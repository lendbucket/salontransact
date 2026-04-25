export const HOSTED_FIELDS_CONFIG = {
  uat: {
    url: "https://cdn.uat.payroc.com/js/hosted-fields/hosted-fields-1.6.0.172429.js",
    integrityHash:
      "sha384-1DFjPXzSRRPT56FXz1ptVP4pwzXPxeNQynxQpU7+5v++p+EbWGprq5TZl8qizGKs",
  },
  production: {
    url: "https://cdn.payroc.com/js/hosted-fields/hosted-fields-1.6.0.172441.js",
    integrityHash:
      "sha384-e1tK2exEUnMhHQYhH2erv/sY3w8jzY/XnnBevNbv20VtjuJpcwb0u9h8qblYjrBl",
  },
};

export function getHostedFieldsConfig() {
  const env = process.env.PAYROC_ENV === "uat" ? "uat" : "production";
  return HOSTED_FIELDS_CONFIG[env];
}
