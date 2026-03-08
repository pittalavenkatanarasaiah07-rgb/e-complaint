import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import PageHeader from "@/components/PageHeader";
import { FileText, Upload, CheckCircle } from "lucide-react";

const crimeTypes = [
  "Theft / Robbery",
  "Assault",
  "Fraud / Cybercrime",
  "Harassment",
  "Domestic Violence",
  "Missing Person",
  "Other",
];

const FileComplaint = () => {
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <PageHeader title="File Complaint" />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-success/10">
            <CheckCircle className="h-10 w-10 text-success" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Complaint Filed</h2>
          <p className="text-center text-sm text-muted-foreground">
            Your complaint has been submitted successfully. You will receive updates via SMS and email.
          </p>
          <p className="text-sm font-medium text-primary">Reference #SG-2026-00847</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PageHeader title="File Complaint" subtitle="Report an incident" />

      <main className="flex-1 space-y-5 px-5 py-6">
        {/* Crime Type */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">Type of Crime</Label>
          <Select>
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Select crime type" />
            </SelectTrigger>
            <SelectContent>
              {crimeTypes.map((type) => (
                <SelectItem key={type} value={type.toLowerCase().replace(/\s/g, "-")}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date & Time */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Date</Label>
            <Input type="date" className="rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Time</Label>
            <Input type="time" className="rounded-xl" />
          </div>
        </div>

        {/* Location */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">Location</Label>
          <Input placeholder="Enter incident location" className="rounded-xl" />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">Description</Label>
          <Textarea
            placeholder="Describe the incident in detail..."
            className="min-h-[120px] rounded-xl"
          />
        </div>

        {/* Upload Evidence */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">Evidence (optional)</Label>
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-secondary/50 p-4">
            <Upload className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Upload photos or documents</span>
          </div>
        </div>

        {/* Contact */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">Your Phone Number</Label>
          <Input type="tel" placeholder="+91 XXXXX XXXXX" className="rounded-xl" />
        </div>

        <Button
          className="w-full rounded-xl py-6 text-base font-semibold shadow-elevated"
          onClick={() => setSubmitted(true)}
        >
          <FileText className="mr-2 h-5 w-5" />
          Submit Complaint
        </Button>
      </main>
    </div>
  );
};

export default FileComplaint;
