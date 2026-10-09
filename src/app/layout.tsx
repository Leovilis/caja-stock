import type { Metadata, Viewport } from "next";
import { Toaster } from "react-hot-toast";
import { AppProvider } from "@/context/AppContext";
import { RecuperarClave } from "@/components/RecuperarClave";
import "./globals.css";

export const metadata: Metadata = {
  title: "Caja & Stock",
  description: "Ventas, caja, stock y gastos para tu drugstore",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = { themeColor: "#1d4ed8", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR">
      <body>
        <AppProvider>
          {children}
          <RecuperarClave />
          <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
        </AppProvider>
      </body>
    </html>
  );
}
