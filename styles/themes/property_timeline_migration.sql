-- Migration for Property Timeline (Property History)

-- 1. Property History Table
CREATE TABLE IF NOT EXISTS property_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- 'valuation', 'visit', 'proposal', 'interaction', 'creation'
    event_date TIMESTAMPTZ DEFAULT NOW(),
    description TEXT,
    old_value NUMERIC, -- Specific for value changes
    new_value NUMERIC, -- Specific for value changes
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL, -- If event is tied to a lead (visit/proposal)
    metadata JSONB, -- For extra details like visit status, proposal terms, etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID -- Operator ID if we had an auth system, but for now just as a placeholder
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_property_history_property_id ON property_history(property_id);
CREATE INDEX IF NOT EXISTS idx_property_history_event_date ON property_history(event_date);

-- Add initial 'creation' events for existing properties if not exists
INSERT INTO property_history (property_id, event_type, description, event_date)
SELECT id, 'creation', 'Imóvel cadastrado no sistema', created_at
FROM properties
WHERE id NOT IN (SELECT property_id FROM property_history WHERE event_type = 'creation');
