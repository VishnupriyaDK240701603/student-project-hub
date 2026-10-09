import { redirect } from "next/navigation";

interface HomePageProps {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function Home({ searchParams }: HomePageProps) {
  const params = searchParams ? await searchParams : {};
  
  if (params?.code) {
    const code = Array.isArray(params.code) ? params.code[0] : params.code;
    redirect(`/auth/callback?code=${encodeURIComponent(code)}`);
  }

  const error = params?.error_description || params?.error;
  if (error) {
    const errorStr = Array.isArray(error) ? error[0] : error;
    redirect(`/login?error=${encodeURIComponent(errorStr)}`);
  }

  redirect("/requests");
}

