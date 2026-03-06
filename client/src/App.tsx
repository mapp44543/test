import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { IconsCacheProvider } from "@/context/icons-cache";
import Home from "@/pages/home";
import Admin from "@/pages/admin";
import NotFound from "@/pages/not-found";
import { usePreloadIcons } from "@/hooks/use-preload-icons";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/admin" component={Admin} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  // Preload all icon types when app starts to prevent flickering
  usePreloadIcons();

  return (
    <Router />
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <IconsCacheProvider>
          <Toaster />
          <AppContent />
        </IconsCacheProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
