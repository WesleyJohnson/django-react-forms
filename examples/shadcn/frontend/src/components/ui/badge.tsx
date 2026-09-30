import * as React from 'react';

import { cn } from '@/lib/utils';

function Badge({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn(
                'inline-flex items-center gap-1 rounded-md border border-transparent bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground',
                className,
            )}
            {...props}
        />
    );
}

export { Badge };
