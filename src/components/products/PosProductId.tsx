import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface Props {
  productId: string;
  integrationId?: string;
  size?: 'sm' | 'md' | 'lg';
  showCopy?: boolean;
}

interface PosLink {
  pos_item_id: string;
  pos_variation_id: string | null;
  integration_id: string;
  source: string;
}

export function PosProductId({ productId, integrationId, size = 'md', showCopy = false }: Props) {
  const [posLinks, setPosLinks] = useState<PosLink[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchPosLinks() {
      try {
        let query = supabase
          .from('product_pos_links')
          .select('pos_item_id, pos_variation_id, integration_id, source')
          .eq('product_id', productId);

        if (integrationId) {
          query = query.eq('integration_id', integrationId);
        }

        const { data, error } = await query;
        
        if (error) {
          console.error('Error fetching POS links:', error);
          return;
        }

        setPosLinks(data || []);
      } catch (error) {
        console.error('Error fetching POS links:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchPosLinks();
  }, [productId, integrationId]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied to clipboard',
      description: `POS ID "${text}" copied to clipboard`,
    });
  };

  if (loading) {
    return <Badge variant="secondary" className="animate-pulse">Loading...</Badge>;
  }

  if (posLinks.length === 0) {
    return <Badge variant="outline" className="text-muted-foreground">No POS Link</Badge>;
  }

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-3 py-1.5'
  };

  return (
    <div className="flex flex-wrap gap-1">
      {posLinks.map((link, index) => {
        const posId = link.pos_variation_id || link.pos_item_id;
        const displayText = link.pos_variation_id 
          ? `${link.pos_item_id}:${link.pos_variation_id}`
          : link.pos_item_id;
        const shortDisplay = link.pos_variation_id 
          ? `${link.pos_item_id.slice(-6)}:${link.pos_variation_id.slice(-6)}`
          : link.pos_item_id.slice(-8);

        return (
          <div key={index} className="flex items-center gap-1">
            <Badge 
              variant="default" 
              className={`font-mono ${sizeClasses[size]} bg-blue-100 text-blue-800 hover:bg-blue-200`}
              title={`${link.source} POS ID: ${displayText}`}
            >
              {size === 'sm' ? shortDisplay : displayText}
            </Badge>
            
            {showCopy && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => copyToClipboard(displayText)}
                title="Copy POS ID"
              >
                <Copy className="h-3 w-3" />
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}