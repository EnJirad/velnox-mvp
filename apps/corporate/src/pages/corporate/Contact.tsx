import { Mail, MapPin, MessageCircle } from "lucide-react";
import { useState } from "react";

const CHANNELS = [
  {
    icon: Mail,
    title: "อีเมล",
    lines: ["support@velnox.com", "privacy@velnox.com"],
  },
  {
    icon: MapPin,
    title: "ที่ตั้ง",
    lines: ["ประเทศไทย", "ให้บริการทั้งประเทศ"],
  },
  {
    icon: MessageCircle,
    title: "ช่องทางอื่น",
    lines: ["Line Official — เร็ว ๆ นี้", "Facebook — เร็ว ๆ นี้"],
  },
] as const;

export function Contact() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const subject = encodeURIComponent(`[ติดต่อ Velnox] จาก ${name || "ผู้เยี่ยมชม"}`);
  const body = encodeURIComponent(
    `ชื่อ: ${name}\nอีเมล: ${email}\n\nข้อความ:\n${message}`,
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-600">
          Velnox Group
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          ติดต่อเรา
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">
          คำถามเกี่ยวกับการใช้งาน การเปิดร้านค้า หรือการร่วมงาน — ทีมเราพร้อมตอบ
        </p>
      </header>

      <div className="mt-10 grid gap-10 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          {CHANNELS.map((channel) => (
            <div
              key={channel.title}
              className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
                <channel.icon className="size-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">{channel.title}</p>
                {channel.lines.map((line) => (
                  <p key={line} className="mt-1 text-sm text-slate-500">
                    {line}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>

        <form
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 lg:col-span-3"
          action={`mailto:support@velnox.com?subject=${subject}&body=${body}`}
          method="post"
          encType="text/plain"
          onSubmit={(e) => {
            // mailto fallback — form submits natively to the user's mail client
            if (!name.trim() || !message.trim()) e.preventDefault();
          }}
        >
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">
            ส่งข้อความถึงเรา
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            ฟอร์มนี้เปิดโปรแกรมอีเมลของคุณ (mailto) — ข้อความจะไม่ถูกส่งผ่านเซิร์ฟเวอร์
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">ชื่อ</span>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ชื่อของคุณ"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">อีเมล</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              />
            </label>
          </div>
          <label className="mt-4 block">
            <span className="text-sm font-medium text-slate-700">ข้อความ</span>
            <textarea
              required
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="เขียนข้อความของคุณ..."
              className="mt-1.5 w-full resize-none rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
          </label>
          <button
            type="submit"
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 sm:w-auto"
          >
            ส่งข้อความ
          </button>
        </form>
      </div>
    </div>
  );
}
