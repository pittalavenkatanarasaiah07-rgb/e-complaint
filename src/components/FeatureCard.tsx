import { type LucideIcon } from "lucide-react";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  variant?: "default" | "emergency";
}

const FeatureCard = ({ icon: Icon, title, description, variant = "default" }: FeatureCardProps) => {
  const isEmergency = variant === "emergency";

  return (
    <button
      className={`group flex w-full items-center gap-4 rounded-2xl border p-5 text-left transition-all hover:shadow-elevated ${
        isEmergency
          ? "border-emergency/20 bg-emergency/5 hover:border-emergency/40"
          : "border-border bg-card hover:border-primary/30"
      }`}
    >
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
          isEmergency
            ? "bg-emergency text-emergency-foreground"
            : "bg-primary/10 text-primary"
        }`}
      >
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <h3 className="font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </button>
  );
};

export default FeatureCard;
