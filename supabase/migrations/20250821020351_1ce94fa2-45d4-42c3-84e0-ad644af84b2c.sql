-- Create enums
CREATE TYPE public.intake_status AS ENUM ('draft', 'submitted', 'approved', 'rejected', 'needs_correction');
CREATE TYPE public.employee_role AS ENUM ('admin', 'staff', 'manager');

-- Create suppliers table
CREATE TABLE public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create products table
CREATE TABLE public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    barcode TEXT UNIQUE,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create employees table
CREATE TABLE public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    role employee_role NOT NULL DEFAULT 'staff',
    hourly_rate DECIMAL(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create product_intakes table
CREATE TABLE public.product_intakes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE RESTRICT NOT NULL,
    submitted_by UUID REFERENCES auth.users(id) ON DELETE RESTRICT NOT NULL,
    invoice_url TEXT,
    status intake_status NOT NULL DEFAULT 'draft',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create product_intake_items table
CREATE TABLE public.product_intake_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    intake_id UUID REFERENCES public.product_intakes(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT NOT NULL,
    quantity_boxes INTEGER NOT NULL CHECK (quantity_boxes > 0),
    units_per_box INTEGER NOT NULL CHECK (units_per_box > 0),
    photo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_intakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_intake_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for suppliers
CREATE POLICY "Authenticated users can view suppliers" ON public.suppliers
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin users can manage suppliers" ON public.suppliers
    FOR ALL TO authenticated 
    USING (EXISTS (
        SELECT 1 FROM public.employees 
        WHERE user_id = auth.uid() AND role = 'admin'
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.employees 
        WHERE user_id = auth.uid() AND role = 'admin'
    ));

-- RLS Policies for products
CREATE POLICY "Authenticated users can view products" ON public.products
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can insert products" ON public.products
    FOR INSERT TO authenticated 
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.employees 
        WHERE user_id = auth.uid() AND role IN ('admin', 'staff', 'manager')
    ));

CREATE POLICY "Admin users can manage products" ON public.products
    FOR ALL TO authenticated 
    USING (EXISTS (
        SELECT 1 FROM public.employees 
        WHERE user_id = auth.uid() AND role = 'admin'
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.employees 
        WHERE user_id = auth.uid() AND role = 'admin'
    ));

-- RLS Policies for employees
CREATE POLICY "Users can view their own employee record" ON public.employees
    FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admin users can manage employees" ON public.employees
    FOR ALL TO authenticated 
    USING (EXISTS (
        SELECT 1 FROM public.employees 
        WHERE user_id = auth.uid() AND role = 'admin'
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.employees 
        WHERE user_id = auth.uid() AND role = 'admin'
    ));

-- RLS Policies for product_intakes
CREATE POLICY "Users can view their own intakes" ON public.product_intakes
    FOR SELECT TO authenticated USING (submitted_by = auth.uid());

CREATE POLICY "Admin can view all intakes" ON public.product_intakes
    FOR SELECT TO authenticated USING (EXISTS (
        SELECT 1 FROM public.employees 
        WHERE user_id = auth.uid() AND role = 'admin'
    ));

CREATE POLICY "Staff can create intakes" ON public.product_intakes
    FOR INSERT TO authenticated 
    WITH CHECK (
        submitted_by = auth.uid() 
        AND EXISTS (
            SELECT 1 FROM public.employees 
            WHERE user_id = auth.uid() AND role IN ('admin', 'staff', 'manager')
        )
    );

CREATE POLICY "Users can update their own intakes" ON public.product_intakes
    FOR UPDATE TO authenticated 
    USING (submitted_by = auth.uid())
    WITH CHECK (submitted_by = auth.uid());

CREATE POLICY "Admin can update all intakes" ON public.product_intakes
    FOR UPDATE TO authenticated 
    USING (EXISTS (
        SELECT 1 FROM public.employees 
        WHERE user_id = auth.uid() AND role = 'admin'
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.employees 
        WHERE user_id = auth.uid() AND role = 'admin'
    ));

-- RLS Policies for product_intake_items
CREATE POLICY "Users can view items from their intakes" ON public.product_intake_items
    FOR SELECT TO authenticated USING (EXISTS (
        SELECT 1 FROM public.product_intakes 
        WHERE id = intake_id AND submitted_by = auth.uid()
    ));

CREATE POLICY "Admin can view all intake items" ON public.product_intake_items
    FOR SELECT TO authenticated USING (EXISTS (
        SELECT 1 FROM public.employees 
        WHERE user_id = auth.uid() AND role = 'admin'
    ));

CREATE POLICY "Users can manage items from their intakes" ON public.product_intake_items
    FOR ALL TO authenticated 
    USING (EXISTS (
        SELECT 1 FROM public.product_intakes 
        WHERE id = intake_id AND submitted_by = auth.uid()
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.product_intakes 
        WHERE id = intake_id AND submitted_by = auth.uid()
    ));

-- Create storage bucket for uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('uploads', 'uploads', false);

-- Storage policies
CREATE POLICY "Authenticated users can upload files" ON storage.objects
    FOR INSERT TO authenticated 
    WITH CHECK (bucket_id = 'uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own files" ON storage.objects
    FOR SELECT TO authenticated 
    USING (bucket_id = 'uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admin can view all files" ON storage.objects
    FOR SELECT TO authenticated 
    USING (
        bucket_id = 'uploads' 
        AND EXISTS (
            SELECT 1 FROM public.employees 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Create function to automatically create employee profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.employees (user_id, full_name, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        'staff'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create employee profile on user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger for product_intakes updated_at
CREATE TRIGGER update_product_intakes_updated_at
    BEFORE UPDATE ON public.product_intakes
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();