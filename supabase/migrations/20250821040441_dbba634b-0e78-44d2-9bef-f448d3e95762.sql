-- Insert sample suppliers
INSERT INTO public.suppliers (name, code) VALUES 
('Cedar Electronics Distribution', 'CED'),
('Global Supply Solutions', 'GSS'),
('Premier Product Partners', 'PPP');

-- Insert sample products
INSERT INTO public.products (name, barcode) VALUES 
('Wireless Bluetooth Headphones', '1234567890123'),
('Smartphone Case - Clear', '2345678901234'),
('USB-C Charging Cable', '3456789012345'),
('Portable Power Bank', '4567890123456'),
('Laptop Stand Adjustable', '5678901234567'),
('Wireless Mouse', '6789012345678');

-- Note: Employee profiles will be created automatically when users sign up via the trigger