import { Input, InputProps } from '@/components/ui/Input';
import { ReactNode } from 'react';

interface InputWithIconProps extends InputProps {
    icon?: ReactNode;
}

export function InputWithIcon({ icon, className, ...props }: InputWithIconProps) {
    return (
        <div className="relative">
            <Input className={`${className} ${icon ? 'pr-10' : ''}`} {...props} />
            {icon && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {icon}
                </div>
            )}
        </div>
    );
} 