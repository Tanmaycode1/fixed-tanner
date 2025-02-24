import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Link as LinkIcon, Mail, Calendar, Shield, Bell, Settings } from 'lucide-react';
import Link from 'next/link';
import type { UserProfile } from '@/types/user';

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
};

interface AccountDetailsProps {
  profile: UserProfile;
}

export function AccountDetails({ profile }: AccountDetailsProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const accountDetails = [
    {
      icon: Shield,
      label: "Account Privacy",
      value: profile.account_privacy,
      type: "privacy"
    },
    {
      icon: Mail,
      label: "Email Verification",
      value: profile.is_verified ? "Verified" : "Not Verified",
      type: "verification"
    }
  ];

  return (
    <motion.div variants={fadeIn}>
      <Card className="overflow-hidden">
        <div className="border-b border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Account Settings
          </h2>
        </div>
        
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {accountDetails.map((detail) => (
            <div key={detail.label} className="p-6 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800">
                  <detail.icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{detail.label}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{detail.value}</p>
                </div>
              </div>
              {detail.type === "privacy" && (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-primary-100 dark:bg-primary-900/50 text-primary-800 dark:text-primary-200">
                  {profile.account_privacy}
                </span>
              )}
              {detail.type === "verification" && (
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  profile.is_verified
                    ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200'
                    : 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200'
                }`}>
                  {profile.is_verified ? 'Verified' : 'Not Verified'}
                </span>
              )}
            </div>
          ))}
        </div>
      </Card>
    </motion.div>
  );
} 