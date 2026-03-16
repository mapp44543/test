export function isUnauthorizedError(error: Error): boolean {
  return /^401: .*Unauthorized/.test(error.message);
}

export function handleUnauthorizedError(error: Error, toast: any) {
  if (isUnauthorizedError(error)) {
    toast({
      title: "Unauthorized",
      description: "Your session has expired. Please login again.",
      variant: "destructive",
    });
    // Redirect to login after showing toast
    setTimeout(() => {
      window.location.href = "/admin";
    }, 1000);
    return true;
  }
  return false;
}
