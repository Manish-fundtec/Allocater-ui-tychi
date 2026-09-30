"use client";

import { useState } from "react";
import { PageHeader } from "@/components/allocator/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function PasswordInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setShow((s) => !s)}
        >
          {show ? "Hide" : "Show"}
        </Button>
      </div>
    </div>
  );
}

export function SettingsContent({ embedded }: { embedded?: boolean }) {
  const [emailFrom, setEmailFrom] = useState("");
  const [smtpHost, setSmtpHost] = useState("");
  const [sendgridKey, setSendgridKey] = useState("");
  const [tychiKey, setTychiKey] = useState("");
  const [tychiUrl, setTychiUrl] = useState("");
  const [connectionOk, setConnectionOk] = useState<boolean | null>(null);

  async function saveEmail() {
    await fetch("/api/allocator/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        section: "email",
        values: {
          EMAIL_FROM: emailFrom,
          SMTP_HOST: smtpHost,
          SENDGRID_API_KEY: sendgridKey,
        },
      }),
    });
  }

  async function saveTychi() {
    await fetch("/api/allocator/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        section: "tychi",
        values: {
          TYCHI_API_KEY: tychiKey,
          TYCHI_API_BASE_URL: tychiUrl,
        },
      }),
    });
  }

  async function testEmail() {
    await fetch("/api/allocator/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "test-email" }),
    });
  }

  async function testConnection() {
    const res = await fetch("/api/allocator/tychi/test-connection");
    if (res.ok) {
      const data = await res.json();
      setConnectionOk(data.connected);
    }
  }

  return (
    <>
      {!embedded ? <PageHeader title="Settings" /> : null}

      <p className="mb-6 text-sm text-gray-500">
        Sensitive keys are stored encrypted in{" "}
        <code className="text-xs">allocator_settings</code> — wire KMS decrypt
        in production.
      </p>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Email settings</CardTitle>
        </CardHeader>
        <CardContent className="grid max-w-lg gap-4">
          <div>
            <Label>From email</Label>
            <Input value={emailFrom} onChange={(e) => setEmailFrom(e.target.value)} />
          </div>
          <div>
            <Label>SMTP Host</Label>
            <Input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} />
          </div>
          <PasswordInput
            label="SendGrid API Key"
            value={sendgridKey}
            onChange={setSendgridKey}
          />
          <div className="flex gap-2">
            <Button onClick={saveEmail}>Save email settings</Button>
            <Button variant="secondary" onClick={testEmail}>
              Send test email
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tychi GL API</CardTitle>
        </CardHeader>
        <CardContent className="grid max-w-lg gap-4">
          <PasswordInput label="API Key" value={tychiKey} onChange={setTychiKey} />
          <div>
            <Label>API Base URL</Label>
            <Input value={tychiUrl} onChange={(e) => setTychiUrl(e.target.value)} />
          </div>
          {connectionOk != null ? (
            <p
              className={
                connectionOk ? "text-sm text-green-600" : "text-sm text-red-600"
              }
            >
              {connectionOk ? "Connected" : "Failed"}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button onClick={saveTychi}>Save Tychi settings</Button>
            <Button variant="secondary" onClick={testConnection}>
              Test connection
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

export default function SettingsPage() {
  return <SettingsContent />;
}
