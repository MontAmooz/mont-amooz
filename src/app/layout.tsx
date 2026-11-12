import type { Metadata } from "next";
import { Vazirmatn, JetBrains_Mono, Darker_Grotesque } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const vazir = Vazirmatn({
  variable: "--font-vazir",
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono-code",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const darkerGrotesque = Darker_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "700", "900"],
});

export const metadata: Metadata = {
  title: "مُنت‌آموز — کتابخانهٔ زندهٔ جزوه‌های درسی ایران",
  description:
    "مرجع آزاد و مشارکتی جزوه‌های درسی؛ معلم‌ها جزوه می‌گذارند، جامعه بهبود می‌دهد. فورک، پیشنهاد ادغام، رتبه‌بندی و تاریخچهٔ نسخه‌ها — مثل گیت‌هاب، برای آموزش.",
  keywords: ["جزوه", "آموزش", "متن‌باز", "معلم", "دانش‌آموز", "مُنت‌آموز", "جزوه رایگان"],
  icons: { icon: "/logo.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body
        className={`${vazir.variable} ${jetbrainsMono.variable} ${darkerGrotesque.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
