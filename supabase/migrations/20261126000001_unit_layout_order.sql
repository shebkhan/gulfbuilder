-- Add layout_order to units for the visual stacking simulator (per-floor ordering).
alter table units add column if not exists layout_order int;

create index if not exists units_building_layout_idx on units (building_id, floor_id, layout_order);