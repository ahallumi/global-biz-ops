import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PrintNodePrinter {
  id: string;
  name: string;
  make_and_model: string;
  default: boolean;
  status: string;
  capabilities?: {
    papers?: Record<string, [number | null, number | null]>;
    dpis?: string[];
    supports_custom_paper_size?: boolean;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const printNodeApiKey = Deno.env.get('PRINTNODE_API_KEY');
    
    if (!printNodeApiKey) {
      console.error('PrintNode API key not configured');
      return new Response(JSON.stringify({ 
        error: 'PrintNode API key not configured' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Fetching printers from PrintNode...');

    const response = await fetch('https://api.printnode.com/printers?capabilities=true', {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${btoa(printNodeApiKey + ':')}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('PrintNode API error:', response.status, errorText);
      return new Response(JSON.stringify({ 
        error: `PrintNode API error: ${response.status}` 
      }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const printers = await response.json();
    console.log(`Found ${printers.length} printers`);

    // Transform printer data
    const transformedPrinters: PrintNodePrinter[] = printers.map((printer: any) => ({
      id: printer.id.toString(),
      name: printer.name || 'Unknown Printer',
      make_and_model: `${printer.description || 'Unknown'} (${printer.status || 'Unknown'})`,
      default: printer.default === true,
      status: printer.state || 'unknown',
      capabilities: printer.capabilities ? {
        papers: printer.capabilities.papers || {},
        dpis: printer.capabilities.dpis || [],
        supports_custom_paper_size: printer.capabilities.supports_custom_paper_size || false,
      } : undefined
    }));

    return new Response(JSON.stringify({ 
      printers: transformedPrinters 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error fetching printers:', error);
    return new Response(JSON.stringify({ 
      error: (error as any)?.message || 'Failed to fetch printers' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});