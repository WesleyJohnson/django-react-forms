import { createContext, useContext } from 'react';
import { type Messages, getDefaultMessages } from './messages';

export const MessagesContext = createContext<Messages | null>(null);

/** The messages of the enclosing ``ReactForm`` (or the global defaults outside one). */
export function useMessages(): Messages {
    return useContext(MessagesContext) ?? getDefaultMessages();
}
