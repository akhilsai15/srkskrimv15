export interface GeolocationData {
  ip: string;
  countryCode: string;
  countryName: string;
  city: string;
  region: string;
  timezone: string;
}

export interface DynamicTermsContent {
  jurisdictionCode: string;
  jurisdictionLabel: string;
  primaryRegulation: string;
  effectiveDate: string;
  introduction: string;
  generalTerms: Array<{ title: string; body: string }>;
  copyrightPolicy: Array<{ title: string; body: string }>;
  privacyPolicy: Array<{ title: string; body: string }>;
  regionalAddendum: { title: string; body: string; code: string };
  dynamicStamp: string;
}

class TermsAgreementService {
  private cacheGeoData: GeolocationData | null = null;

  /**
   * Fetches the user's real-time geolocation details via safe public APIs.
   * Leverages ipapi.co or ip-api.com, falling back to browser locale indicators.
   */
  async getUserLocation(): Promise<GeolocationData> {
    if (this.cacheGeoData) {
      return this.cacheGeoData;
    }

    try {
      // Primary API: ipapi.co (HTTPS-secure and highly reliable)
      const res = await fetch("https://ipapi.co/json/");
      if (res.ok) {
        const data = await res.json();
        if (data && data.ip) {
          this.cacheGeoData = {
            ip: data.ip,
            countryCode: data.country_code || "US",
            countryName: data.country_name || "United States",
            city: data.city || "Unknown City",
            region: data.region || "Unknown Region",
            timezone: data.timezone || "America/New_York",
          };
          return this.cacheGeoData;
        }
      }
    } catch (e) {
      console.warn("Primary Geolocation API failed, trying fallback:", e);
    }

    try {
      // Secondary Fallback API: ip-api.com
      const res = await fetch("https://ip-api.com/json/");
      if (res.ok) {
        const data = await res.json();
        if (data && data.query) {
          this.cacheGeoData = {
            ip: data.query,
            countryCode: data.countryCode || "US",
            countryName: data.country || "United States",
            city: data.city || "Unknown City",
            region: data.regionName || "Unknown Region",
            timezone: data.timezone || "America/New_York",
          };
          return this.cacheGeoData;
        }
      }
    } catch (e) {
      console.warn("Secondary Geolocation API failed:", e);
    }

    // Comprehensive Client-Side Fallback based on browser settings and timezone
    const browserLang = navigator.language || "en-US";
    const inferredCountry = this.inferCountryFromLocale(browserLang);
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

    this.cacheGeoData = {
      ip: "127.0.0.1 (Local Sandbox)",
      countryCode: inferredCountry,
      countryName: this.getCountryNameFromCode(inferredCountry),
      city: "Detected Client Location",
      region: "Browser Locale Channel",
      timezone: timeZone,
    };

    return this.cacheGeoData;
  }

  /**
   * Infers a country code from the browser's locale indicator
   */
  private inferCountryFromLocale(locale: string): string {
    const split = locale.split("-");
    if (split.length > 1) {
      return split[1].toUpperCase();
    }
    // Simple heuristic matches
    const lang = split[0].toLowerCase();
    if (lang === "en") return "US";
    if (lang === "hi" || lang === "ta" || lang === "te" || lang === "kn" || lang === "ml") return "IN";
    if (lang === "pt") return "BR";
    if (lang === "fr") return "FR";
    if (lang === "de") return "DE";
    if (lang === "es") return "ES";
    if (lang === "ca") return "CA";
    if (lang === "zh") return "CN";
    if (lang === "ja") return "JP";
    return "US";
  }

  private getCountryNameFromCode(code: string): string {
    const countries: Record<string, string> = {
      US: "United States",
      IN: "India",
      BR: "Brazil",
      CA: "Canada",
      AU: "Australia",
      GB: "United Kingdom",
      FR: "France",
      DE: "Germany",
      ES: "Spain",
      IT: "Italy",
      NL: "Netherlands",
      JP: "Japan",
      CN: "China",
      MX: "Mexico",
    };
    return countries[code] || "Global Region";
  }

  /**
   * Identifies the primary binding regulatory framework based on Country Code
   */
  getPrimaryRegulation(countryCode: string): { regulation: string; code: string; label: string } {
    const code = countryCode.toUpperCase();
    
    // European Union / EEA + UK (GDPR/UK GDPR)
    const euCountries = [
      "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", 
      "IE", "IT", "LV", "LT", "LU", "MT", "PL", "PT", "RO", "SK", "SI", "ES", "SE", 
      "GB", "CH", "NO", "IS", "LI"
    ];

    if (euCountries.includes(code)) {
      return {
        regulation: "General Data Protection Regulation (GDPR / UK GDPR) & DSA",
        code: "eu_gdpr",
        label: "European Union & United Kingdom Jurisdiction"
      };
    }

    if (code === "US") {
      return {
        regulation: "California Consumer Privacy Act (CCPA/CPRA) & COPPA Standards",
        code: "us_ccpa",
        label: "United States Federal & State Jurisdiction"
      };
    }

    if (code === "IN") {
      return {
        regulation: "Digital Personal Data Protection Act, 2023 (DPDP Act)",
        code: "in_dpdp",
        label: "Republic of India National Jurisdiction"
      };
    }

    if (code === "BR") {
      return {
        regulation: "Lei Geral de Proteção de Dados (LGPD - Law 13.709/2018)",
        code: "br_lgpd",
        label: "Federative Republic of Brazil Jurisdiction"
      };
    }

    if (code === "CA") {
      return {
        regulation: "Personal Information Protection & Electronic Documents Act (PIPEDA)",
        code: "ca_pipeda",
        label: "Canada Federal Privacy Jurisdiction"
      };
    }

    if (code === "AU") {
      return {
        regulation: "Australian Privacy Act 1988 & Australian Privacy Principles (APPs)",
        code: "au_privacy",
        label: "Commonwealth of Australia Jurisdiction"
      };
    }

    // Default global framework combining principles of GDPR and CCPA
    return {
      regulation: "WIPO Intellectual Property & UN Guidelines for Consumer Protection (UNCTAD)",
      code: "global_un",
      label: "International Global Trade Jurisdiction"
    };
  }

  /**
   * Dynamically compiles standard terms based on geolocation & country-specific rules
   */
  async generateLocalizedTerms(): Promise<DynamicTermsContent> {
    const geo = await this.getUserLocation();
    const regulationInfo = this.getPrimaryRegulation(geo.countryCode);
    const currentDate = new Date().toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric"
    });

    // Generate dynamic timestamp stamp for verification
    const stamp = `SECURE_STAMP_ID: [${geo.countryCode}-${geo.ip.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase()}-${Date.now().toString().slice(-6)}]`;

    // Initialize terms
    const terms: DynamicTermsContent = {
      jurisdictionCode: regulationInfo.code,
      jurisdictionLabel: regulationInfo.label,
      primaryRegulation: regulationInfo.regulation,
      effectiveDate: currentDate,
      dynamicStamp: stamp,
      introduction: `This agreement is formulated in real-time for your connection originating from ${geo.city}, ${geo.region}, ${geo.countryName} (IP: ${geo.ip}) under the primary governing authority of ${regulationInfo.regulation}. By using this service, you enter into a legally binding agreement in full accordance with the sovereign statutes of ${geo.countryName}.`,
      
      generalTerms: [
        {
          title: "1. Definition of Services & Scope",
          body: `The service is a dynamic social engagement and digital publishing container ("SkrimChat") allowing real-time workspace collaboration, messaging, and localized sandboxed book publication services. Services are hosted on secure, regionalized containers. You are granted a limited, personal, non-transferable, and revocable license to access the interface for compliant activities.`
        },
        {
          title: "2. Absolute User Eligibility",
          body: `You represent that your registration details are accurate. By checking the age confirmation toggle, you certify compliance with the minimum legal age bounds of ${geo.countryName} (13+ under COPPA/GDPR/DPDP rules). Under-age accounts are systematically prohibited and subject to immediate purging.`
        },
        {
          title: "3. Responsible Sandbox Utilization",
          body: "All communications, text blocks, or documents uploaded into your isolated database sandbox must remain compliant with localized hate speech, public safety, and national harmony statutes. You are strictly forbidden from executing packet injection, data harvesting, or visual scraper bots against the iframe container."
        },
        {
          title: "4. Disclaimers of Liability",
          body: "To the maximum extent permitted by sovereign law, the platform is provided on an 'as-is' and 'as-available' baseline. Under no circumstances shall the publishers, platform administrators, or operators be held liable for storage corruption, IndexedDB database flushes, localized cookie expiry, or browser-side cache wipes."
        }
      ],

      copyrightPolicy: [
        {
          title: "1. Protected Material & Upload Integrity",
          body: "When using the e-reading system or importing digital files (e.g., EPUB, PDF, txt), you explicitly guarantee that you own the digital reproduction rights or that your access falls cleanly under non-commercial private study, classroom educational instruction, or statutory 'Fair Use / Fair Dealing' standards."
        },
        {
          title: "2. WIPO & DMCA Takedown Procedures",
          body: `In accordance with the Digital Millennium Copyright Act (US) and the WIPO Copyright Treaty, we operate a zero-tolerance copyright infringement scheme. If you represent a global copyright holder and believe any material within our workspace infringes your legal rights, you can report it to our designated agent. Upon receiving an authenticated complaint, files will be locked or purged from the database index instantly.`
        }
      ],

      privacyPolicy: [
        {
          title: "1. Data Storage Locality & Minimization",
          body: `All state data, interactive chat logs, reading margins, and active bookmarks are saved locally on your device via secure client-side storage (IndexedDB, localStorage). Account profile credentials and metadata are securely managed in regional server instances. No tracking cookies or advertising pixels are used to target you.`
        },
        {
          title: "2. Consent Revocation & Data Purging",
          body: "You maintain absolute ownership of your data rights. You may revoke consent at any time. Clicking the account deletion buttons or deleting custom books physically triggers immediate, cryptographically complete erasure of all records from local and remote nodes."
        }
      ],

      regionalAddendum: this.getAddendumForCode(regulationInfo.code, geo.countryName)
    };

    return terms;
  }

  private getAddendumForCode(code: string, countryName: string): { title: string; body: string; code: string } {
    switch (code) {
      case "eu_gdpr":
        return {
          code: "GDPR_DSA_EU",
          title: "European Union & UK Regional Addendum (GDPR & DSA)",
          body: "In accordance with the General Data Protection Regulation (EU 2016/679) and the Digital Services Act (DSA): We act as Data Controller of your profile data. You are granted clear rights of access, rectification, objection, portability, and the immediate Right to be Forgotten (Article 17). Consent is completely voluntary and can be withdrawn seamlessly. For complaints, you retain the statutory right to lodge an appeal with your national Data Protection Authority (DPA) or Information Commissioner's Office (ICO) in the UK."
        };
      case "us_ccpa":
        return {
          code: "CCPA_COPPA_US",
          title: "United States Specific Addendum (CCPA, CPRA & COPPA)",
          body: "Under the California Consumer Privacy Act (CCPA) and California Privacy Rights Act (CPRA): We certify that we do NOT sell, lease, or share your personal data or reading logs to marketing brokers, data aggregators, or third parties (Zero Sale/Sharing of Personal Info). You have the right to request disclosure of categories of information we hold, and request deletion. In strict compliance with the Children's Online Privacy Protection Act (COPPA), we do not intentionally compile information from minors under 13."
        };
      case "in_dpdp":
        return {
          code: "DPDP_IN_2023",
          title: "Republic of India Regional Addendum (DPDP Act, 2023)",
          body: "Pursuant to the Digital Personal Data Protection Act, 2023: We process your personal data under the lawful basis of unambiguous, specific, and clear consent. You have the right to nominate a Consent Manager, retract your consent easily, access a summary of your data, and invoke Grievance Redressal mechanisms. For grievances, users can appeal directly to our grievance officer or escalate cases to the Data Protection Board of India."
        };
      case "br_lgpd":
        return {
          code: "LGPD_BR",
          title: "Brazil Regional Addendum (Lei Geral de Proteção de Dados)",
          body: "In compliance with Lei Geral de Proteção de Dados (LGPD - Law 13.709/2018): Brazilian residents are granted statutory confirmation of data processing, rectifications, anonymization, blockages of unnecessary information, and portability of database records. You may exercise these rights directly via account configurations."
        };
      case "ca_pipeda":
        return {
          code: "PIPEDA_CA",
          title: "Canada Regional Addendum (PIPEDA)",
          body: "In compliance with the Personal Information Protection and Electronic Documents Act (PIPEDA) and standard Canadian fair information principles: Consent is documented transparently before any data storage occurs, processing purposes are clearly identified, and information integrity is guarded with advanced transport-layer encryption."
        };
      case "au_privacy":
        return {
          code: "PRIVACY_ACT_AU",
          title: "Australia Regional Addendum (Australian Privacy Principles)",
          body: "Under the Australia Privacy Act 1988 and Australian Privacy Principles (APPs): We ensure advanced protective safeguards are set against unauthorized access or breaches. In the event of a significant data exposure, we are committed to fulfilling the Notifiable Data Breaches (NDB) scheme, reporting directly to affected citizens and the OAIC."
        };
      default:
        return {
          code: "GLOBAL_UN_WIPO",
          title: "International General Addendum (UN Guidelines & WIPO)",
          body: `By using SkrimChat from ${countryName}, you enter into a globally-compliant agreement aligned with the WIPO Copyright Treaty and United Nations Guidelines for Consumer Protection. Intellectual property laws are respected, and your privacy is preserved using localized data sandboxes without tracking cookies.`
        };
    }
  }
}

export const termsAgreementService = new TermsAgreementService();
