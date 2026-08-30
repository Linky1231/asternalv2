import { motion } from "framer-motion";
import { Gamepad2, Users, MessageCircle, Sparkles, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.25, 0.4, 0.25, 1] as const },
  }),
};

const features = [
  {
    icon: MessageCircle,
    title: "Comparte tus momentos",
    desc: "Publica highlights, estrategias e historias con tu comunidad.",
  },
  {
    icon: Users,
    title: "Arma tu escuadrón",
    desc: "Conéctate con gamers que comparten tu pasión y estilo de juego.",
  },
  {
    icon: Gamepad2,
    title: "Gaming primero",
    desc: "Un espacio social hecho por gamers, para gamers — sin ruido, solo comunidad.",
  },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold tracking-tight">Asternal</span>
          </div>
          <Button size="sm" className="gap-1.5" onClick={() => navigate("/auth")}>
            Comenzar <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </nav>

      <section className="relative flex min-h-screen items-center justify-center pt-16">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/50 px-4 py-1.5 text-xs font-medium text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Versión 1 disponible
            </div>
          </motion.div>

          <motion.h1
            className="text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={1}
          >
            Tu Comunidad{" "}
            <span className="text-primary">Gamer</span>{" "}
            te espera
          </motion.h1>

          <motion.p
            className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={2}
          >
            Asternal es el centro social para gamers. Comparte momentos, conecta
            con tu escuadrón y construye algo juntos.
          </motion.p>

          <motion.div
            className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={3}
          >
            <Button size="lg" className="gap-2 px-8" onClick={() => navigate("/auth")}>
              Únete a la comunidad
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="gap-2 px-8"
              onClick={() => navigate("/auth?returnTo=/dashboard")}
            >
              Iniciar sesión
            </Button>
          </motion.div>
        </div>
      </section>

      <section className="border-t border-border/50 bg-muted/30 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <motion.div
            className="text-center"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeUp}
            custom={0}
          >
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">
              Lo que obtienes
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Hecho para la comunidad
            </h2>
          </motion.div>

          <div className="mt-16 grid gap-6 sm:grid-cols-3">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                className="group rounded-2xl border border-border/60 bg-card p-8 transition-colors hover:border-primary/30 hover:bg-accent/50"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-80px" }}
                variants={fadeUp}
                custom={i + 1}
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {f.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeUp}
            custom={0}
          >
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              ¿Listo para subir de nivel?
            </h2>
            <p className="mt-4 text-muted-foreground">
              Únete a Asternal y sé parte de algo más grande.
            </p>
            <Button
              size="lg"
              className="mt-8 gap-2 px-10"
              onClick={() => navigate("/auth")}
            >
              Comenzar gratis
              <ChevronRight className="h-4 w-4" />
            </Button>
          </motion.div>
        </div>
      </section>

      <footer className="border-t border-border/50 py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4" />
            Asternal
          </div>
          <p className="text-xs text-muted-foreground/60">
            &copy; {new Date().getFullYear()} Asternal. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
