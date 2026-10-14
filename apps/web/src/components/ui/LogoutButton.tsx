'use client';

import { Button } from './Button';
import { clearChatbotStorage } from '../../lib/ai/chatbot-session';

export { clearChatbotStorage };

export function LogoutButton() {
  return (
    <form
      action="/api/auth/logout"
      method="post"
      onSubmit={() => {
        clearChatbotStorage();
      }}
    >
      <Button type="submit">Log out</Button>
    </form>
  );
}
