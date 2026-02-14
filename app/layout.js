export const metadata = {
  title: "Fantrove CMS",
  description: "Internal content editor",
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body style={{ margin: 0 }}>
        {children}
      </body>
    </html>
  );
}