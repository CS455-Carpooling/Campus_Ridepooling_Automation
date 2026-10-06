import { Button } from './Button';

export function LogoutButton() {
  return (
    <form action="/api/auth/logout" method="post">
      <Button type="submit">Log out</Button>
    </form>
  );
}
