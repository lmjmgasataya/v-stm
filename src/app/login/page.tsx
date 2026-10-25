import { redirect } from "next/navigation";
import { getViewer } from "@/lib/access";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  // getViewer, not getSession: a valid cookie for a since-deleted user must still see the form
  if (await getViewer()) redirect("/");

  return <LoginForm />;
}
