import type { Metadata } from "next";
import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import StatsBar from "@/components/StatsBar";
import Recursos from "@/components/Recursos";
import ComoFunciona from "@/components/ComoFunciona";
import Planos from "@/components/Planos";
import Cta from "@/components/Cta";
import Footer from "@/components/Footer";
import { getCurrentUser } from "@/server/auth";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
};

export default async function Home() {
  const loggedIn = Boolean(await getCurrentUser());

  return (
    <>
      <Nav loggedIn={loggedIn} />
      <main>
        <Hero />
        <StatsBar />
        <Recursos />
        <ComoFunciona />
        <Planos />
        <Cta />
      </main>
      <Footer loggedIn={loggedIn} />
    </>
  );
}
