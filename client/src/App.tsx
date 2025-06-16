import React from "react";
import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Skeleton } from "@/components/ui/skeleton";
import { queryClient } from "./lib/queryClient";
import { AuthProvider } from "@/components/AuthProvider";
import { useAuth } from "@/hooks/useAuth";
import { useGleap } from "@/hooks/useGleap";
import { LoginForm } from "@/components/LoginForm";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/dashboard";
import { Conversas } from "./pages/conversas";
import { Pipeline } from "./pages/pipeline";
import { Consultas } from "./pages/consultas";
import { Contatos } from "./pages/contatos";
import { Configuracoes } from "./pages/configuracoes";
import { LiviaConfig } from "./pages/livia-config";
import { ContatoDetalhes } from "./pages/contato-detalhes";
// import { Prontuario } from "./pages/prontuario";
import { Perfil } from "./pages/perfil";
import { RecuperarSenha } from "./pages/recuperar-senha";
import { ResetPassword } from "./pages/reset-password";
import Landing from "@/pages/landing";
import NotFound from "@/pages/not-found";

function Router() {
  const [location] = useLocation();
  const { user, loading } = useAuth();
  
  console.log('🔍 Router state:', { user: !!user, loading, location });
  
  const getCurrentPage = () => {
    if (location === "/") return "dashboard";
    return location.substring(1);
  };

  if (loading) {
    console.log('⏳ Loading state - showing skeleton');
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="space-y-4 w-full max-w-md">
          <Skeleton className="h-8 w-3/4 mx-auto" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3 mx-auto" />
        </div>
      </div>
    );
  }

  if (!user) {
    console.log('🔑 No user - showing login form');
    
    // Check if this is a password reset page
    if (location === '/reset-password') {
      return <ResetPassword />;
    }
    
    return <LoginForm />;
  }

  console.log('✅ User authenticated - showing main app');

  return (
    <Layout currentPage={getCurrentPage()}>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/conversas" component={Conversas} />
        <Route path="/pipeline" component={Pipeline} />
        <Route path="/consultas" component={Consultas} />
        <Route path="/contatos" component={Contatos} />
        <Route path="/contatos/:id" component={ContatoDetalhes} />
        {/* <Route path="/prontuario/:id?" component={Prontuario} /> */}
        <Route path="/configuracoes" component={Configuracoes} />
        <Route path="/livia-config" component={LiviaConfig} />
        <Route path="/perfil" component={Perfil} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function GleapWrapper() {
  useGleap(); // Initialize Gleap with user data
  return <Router />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <GleapWrapper />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
