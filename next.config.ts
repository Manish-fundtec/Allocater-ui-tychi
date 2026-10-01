import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  serverExternalPackages: [
    "pg",
    "pg-hstore",
    "sequelize",
    "winston",
    "nodemailer",
  ],
  async redirects() {
    return [
      {
        source: "/allocator/investors",
        destination: "/allocator/fund?tab=investors",
        permanent: false,
      },
      {
        source: "/allocator/nav",
        destination: "/allocator/fund?tab=nav",
        permanent: false,
      },
      {
        source: "/allocator/pl-reports",
        destination: "/allocator/pl?tab=reports",
        permanent: false,
      },
      {
        source: "/allocator/import",
        destination: "/allocator/pl?tab=import",
        permanent: false,
      },
      {
        source: "/allocator/fees/review",
        destination: "/allocator/allocation?tab=review",
        permanent: false,
      },
      {
        source: "/allocator/fees",
        destination: "/allocator/allocation?tab=structure",
        permanent: false,
      },
      {
        source: "/allocator/allocation/breakdown/:investorId",
        destination: "/allocator/allocation?tab=review&investorId=:investorId",
        permanent: false,
      },
      {
        source: "/allocator/allocation/history",
        destination: "/allocator/allocation?tab=history",
        permanent: false,
      },
      {
        source: "/allocator/settings",
        destination: "/allocator/reports?tab=settings",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
