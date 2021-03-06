;with src as (
	select
	"Site.Name" "name",
	ST_SetSRID(st_makepoint(cast("Longitude" as float), cast("Latitude" as float)), 4326) xyz
	from ec_flux_ec_flux_temp
)
insert into public.sites ("name", xyz)
select distinct
"name",
xyz
from src
on conflict on constraint sites_unique_cols do nothing;


;with src as (
	select
	"Site.Name" "name",
	ST_SetSRID(st_makepoint(cast("Longitude" as float), cast("Latitude" as float)), 4326) xyz,
	'FLUXNET' network
	from ec_flux_ec_flux_temp
	where "FLUXNET" = '1'
)
insert into public.site_network_xref (site_id, network_id)
select
s.id site_id,
n.id network_id
from src t
join sites s on s."name" = t."name" and st_equals(t.xyz, s.xyz)
join networks n on upper(n.acronym) = upper(t.network)
on conflict on constraint site_network_xref_unique_cols do nothing;