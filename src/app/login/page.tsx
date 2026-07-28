import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next = "/catalog" } = await searchParams;
  return (
    <>
      <div className="page__head">
        <p className="eyebrow">Access</p>
        <h1 className="page__title">Sign in</h1>
      </div>
      <LoginForm next={next} />
    </>
  );
}
