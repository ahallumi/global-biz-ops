import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PrintRequest {
  printer_id: string;
  title: string;
  base64: string;
  source: string;
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

    const { printer_id, title, base64, source }: PrintRequest = await req.json();

    if (!printer_id || !title || !base64) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: printer_id, title, base64' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Submitting print job:', { printer_id, title, source });

    const printJob = {
      printerId: parseInt(printer_id),
      title: title,
      contentType: 'pdf_base64',
      content: base64,
      source: source || 'label-print'
    };

    const response = await fetch('https://api.printnode.com/printjobs', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(printNodeApiKey + ':')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(printJob),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('PrintNode API error:', response.status, errorText);
      return new Response(JSON.stringify({ 
        error: `Print job failed: ${response.status}` 
      }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await response.json();
    console.log('Print job submitted successfully:', result);

    return new Response(JSON.stringify({ 
      job_id: result.toString(),
      status: 'submitted'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error submitting print job:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Failed to submit print job' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});