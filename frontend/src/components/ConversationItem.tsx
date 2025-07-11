'use client';
import { Button } from './ui/button'
import { cn } from '@/lib/utils'

interface Props {
  conv: any;
  selected?: boolean;
  unread?: boolean;
  onClick: () => void;
}

function getCustomerName(conv: any) {
  return (
    conv.customer?.name ||
    conv.customer?.full_name ||
    conv.customer_name ||
    conv.name ||
    conv.subject ||
    'Unknown'
  );
}

function getPropertyTitle(conv: any) {
  return (
    conv.property_title ||
    conv.property?.title ||
    conv.property?.name ||
    ''
  );
}

function getStayDates(conv: any) {
  const inDate = conv.check_in_date || conv.checkInDate;
  const outDate = conv.check_out_date || conv.checkOutDate;
  return inDate && outDate ? `${inDate} - ${outDate}` : '';
}

function getChannel(conv: any) {
  return conv.channel_type || conv.channelType || '';
}

function getLastMessage(conv: any) {
  if (Array.isArray(conv.messages) && conv.messages.length) {
    return conv.messages[conv.messages.length - 1];
  }
  return conv.last_message || conv.lastMessage || null;
}

function preview(content?: string) {
  if (!content) return '';
  const line = content.split('\n')[0];
  return line.length > 50 ? line.slice(0, 50) + '...' : line;
}

function relativeTime(ts?: string) {
  if (!ts) return ''
  const diff = Date.now() - new Date(ts).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

export default function ConversationItem({ conv, selected, unread, onClick }: Props) {
  return (
    <li>
      <Button
        className={cn(
          'w-full text-left h-auto border',
          unread && 'bg-blue-50 dark:bg-blue-900 border-blue-500 dark:border-blue-700',
          selected && 'bg-muted'
        )}
        onClick={onClick}
        variant="secondary"
        size="default"
      >
        <div className="flex w-full justify-between">
          <div className="flex-1 pr-2 overflow-hidden">
            <div className={`truncate ${unread ? 'font-semibold' : 'font-medium'}`}>{getCustomerName(conv)}</div>
            {getPropertyTitle(conv) && (
              <div className="text-xs text-muted-foreground dark:text-gray-400 truncate">
                {getPropertyTitle(conv)}
              </div>
            )}
            {(getStayDates(conv) || getChannel(conv)) && (
              <div className="text-xs text-muted-foreground dark:text-gray-400 truncate">
                {getStayDates(conv)}{getChannel(conv) ? ` • ${getChannel(conv)}` : ''}
              </div>
            )}
            <div className="text-xs text-muted-foreground dark:text-gray-400 truncate">
              {preview(getLastMessage(conv)?.content)}
            </div>
          </div>
          <div className="text-right pl-2">
            <div className="text-xs text-muted-foreground dark:text-gray-400 whitespace-nowrap">
              {relativeTime(
                getLastMessage(conv)?.created_at ||
                getLastMessage(conv)?.createdAt
              )}
            </div>
            {unread && (
              <span className="ml-2 mt-1 inline-block h-2 w-2 rounded-full bg-blue-500" />
            )}
          </div>
        </div>
      </Button>
    </li>
  );
}
