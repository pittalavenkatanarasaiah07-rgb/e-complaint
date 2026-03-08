import { useState } from "react";

const languages = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "hi", label: "हिंदी", flag: "🇮🇳" },
  { code: "te", label: "తెలుగు", flag: "🇮🇳" },
];

const LanguageSwitcher = () => {
  const [active, setActive] = useState("en");

  return (
    <div className="flex items-center gap-1 rounded-full bg-card p-1 shadow-card">
      {languages.map((lang) => (
        <button
          key={lang.code}
          onClick={() => setActive(lang.code)}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all ${
            active === lang.code
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>{lang.flag}</span>
          <span>{lang.label}</span>
        </button>
      ))}
    </div>
  );
};

export default LanguageSwitcher;
