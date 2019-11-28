import { pickBy } from 'ramda'
import { log, logError } from '../../lib/log'

/**
 * args.input
 * [{input1}, {input2}, etc]
 */
export default async (self, args, req) => {
  const { pool, query } = await req.ctx.db
  const { findVariables } = req.ctx.db.dataLoaders
  const { input: inputs } = args
  const nonDynamicUpdateCols = [
    'id',
    'addDataproducts',
    'removeDataproducts',
    'addDirectlyRelatedProtocols',
    'addIndirectlyRelatedProtocols',
    'removeProtocols',
    'addRForicings',
    'removeRForcings'
  ]

  for (const input of inputs) {
    const {
      addDataproducts,
      removeDataproducts,
      addDirectlyRelatedProtocols,
      addIndirectlyRelatedProtocols,
      removeProtocols,
      addRForicings,
      removeRForcings
    } = input

    // Update the Variable entity
    const update = pickBy((v, k) => (nonDynamicUpdateCols.includes(k) ? false : true), input)
    if (Object.keys(update).length > 0) {
      const keyVals = Object.entries(update)
      await query({
        text: `update public.variables set ${keyVals
          .map(([attr], i) => `"${attr}" = $${i + 1}`)
          .join(',')} where id = $${keyVals.length + 1}`,
        values: keyVals.map(([, val]) => val).concat(input.id)
      })
    }

    // Add dataproducts
    if (addDataproducts)
      await query({
        text: `insert into public.dataproduct_variable_xref (dataproduct_id, variable_id) values (${addDataproducts
          .map((id, i) => ['$1', `$${i + 2}`])
          .join(
            '),('
          )}) on conflict on constraint dataproduct_variable_xref_unique_cols do nothing;`,
        values: [input.id].concat(addDataproducts.map(id => id))
      })

    // Remove dataproducts
    if (removeDataproducts)
      await query({
        text: `delete from public.dataproduct_variable_xref where variable_id = $1 and dataproduct_id in (${removeDataproducts
          .map((id, i) => `$${i + 2}`)
          .join(',')});`,
        values: [input.id].concat(removeDataproducts.map(id => id))
      })

    // Add RForcings
    if (addRForicings)
      await query({
        text: `insert into public.rforcing_variable_xref (rforcing_id, variable_id) values (${addRForicings
          .map((id, i) => ['$1', `$${i + 2}`])
          .join('),(')}) on conflict on constraint rforcings_variable_xref_unique_cols do nothing;`,
        values: [input.id].concat(addRForicings.map(id => id))
      })

    // Remove RForcings
    if (removeRForcings)
      await query({
        text: `delete from public.rforcing_variable_xref where variable_id = $1 and rforcing_id in (${removeRForcings
          .map((id, i) => `$${i + 2}`)
          .join(',')});`,
        values: [input.id].concat(removeRForcings.map(id => id))
      })

    // Add protocols
    if (addDirectlyRelatedProtocols || addIndirectlyRelatedProtocols) {
      const updates = (addDirectlyRelatedProtocols || [])
        .map(id => [id, 'direct'])
        .concat((addIndirectlyRelatedProtocols || []).map(id => [id, 'indirect']))

      await query({
        text: `insert into protocol_variable_xref (protocol_id, variable_id, relationship_type_id) values (${updates
          .map((u, i) => [
            `$${i + 2}`,
            '$1',
            `(select id from public.relationship_types where "name" = '${u[1]}')`
          ])
          .join('),(')}) on conflict on constraint protocol_variable_xref_unique_cols do nothing;`,
        values: [input.id].concat(updates.map(u => u[0]))
      })
    }

    // Remove protocols
    if (removeProtocols)
      await query({
        text: `delete from public.protocol_variable_xref where variable_id = $1 and protocol_id in (${removeProtocols
          .map((id, i) => `$${i + 2}`)
          .join(',')});`,
        values: [input.id].concat(removeProtocols.map(id => id))
      })
  }

  // Return the updated rows
  const updatedRows = []
  for (const input of inputs) {
    const result = await findVariables(input.id)
    updatedRows.push(result[0])
  }

  return updatedRows
}
