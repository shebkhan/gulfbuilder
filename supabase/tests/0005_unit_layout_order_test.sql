-- pgTAP: unit layout_order column for the stacking simulator.
begin;

create extension if not exists pgtap;

select plan(1);

select has_column('public', 'units', 'layout_order', 'units have a layout_order column');

select * from finish();
rollback;