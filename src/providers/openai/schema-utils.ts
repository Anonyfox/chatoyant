/**
 * OpenAI JSON Schema utilities for structured output.
 *
 * OpenAI's structured output has strict requirements that differ from standard JSON Schema:
 * 1. All objects must have `additionalProperties: false`
 * 2. All properties must be listed in the `required` array
 * 3. Optional properties must use `anyOf: [type, { type: 'null' }]` pattern
 *
 * @module providers/openai/schema-utils
 */

/**
 * Transform a JSON Schema to comply with OpenAI's strict structured output requirements.
 *
 * This function recursively transforms a schema to:
 * - Add `additionalProperties: false` to all object types
 * - Ensure all properties are in the `required` array
 * - Convert optional properties to nullable using `anyOf`
 *
 * @param schema - The JSON Schema to transform
 * @returns A transformed schema compatible with OpenAI's strict mode
 *
 * @example
 * ```typescript
 * const schema = {
 *   type: 'object',
 *   properties: {
 *     name: { type: 'string' },
 *     age: { type: 'number' }
 *   },
 *   required: ['name']  // age is optional
 * };
 *
 * const strict = makeOpenAIStrict(schema);
 * // Result:
 * // {
 * //   type: 'object',
 * //   additionalProperties: false,
 * //   properties: {
 * //     name: { type: 'string' },
 * //     age: { anyOf: [{ type: 'number' }, { type: 'null' }] }
 * //   },
 * //   required: ['name', 'age']
 * // }
 * ```
 */
export function makeOpenAIStrict(schema: Record<string, unknown>): Record<string, unknown> {
  const result = { ...schema };

  if (result.type === 'object') {
    result.additionalProperties = false;

    const props = result.properties as Record<string, Record<string, unknown>> | undefined;
    if (props) {
      const currentRequired = (result.required as string[]) || [];
      const allKeys = Object.keys(props);

      // Process each property
      const newProps: Record<string, Record<string, unknown>> = {};
      for (const [key, value] of Object.entries(props)) {
        const isOptional = !currentRequired.includes(key);
        const transformed = makeOpenAIStrict(value);

        if (isOptional) {
          // Make optional properties nullable using anyOf
          newProps[key] = {
            anyOf: [transformed, { type: 'null' }],
          };
        } else {
          newProps[key] = transformed;
        }
      }

      result.properties = newProps;
      result.required = allKeys; // All properties must be required
    }
  }

  if (result.type === 'array' && result.items && typeof result.items === 'object') {
    result.items = makeOpenAIStrict(result.items as Record<string, unknown>);
  }

  return result;
}

/**
 * Check if a schema needs transformation for OpenAI strict mode.
 *
 * @param schema - The JSON Schema to check
 * @returns True if the schema needs transformation
 */
export function needsOpenAIStrictTransform(schema: Record<string, unknown>): boolean {
  if (schema.type === 'object') {
    if (schema.additionalProperties !== false) return true;

    const props = schema.properties as Record<string, Record<string, unknown>> | undefined;
    if (props) {
      const required = (schema.required as string[]) || [];
      const allKeys = Object.keys(props);

      // Check if all keys are in required
      if (allKeys.length !== required.length || !allKeys.every((k) => required.includes(k))) {
        return true;
      }

      // Check nested objects
      for (const value of Object.values(props)) {
        if (needsOpenAIStrictTransform(value)) return true;
      }
    }
  }

  if (schema.type === 'array' && schema.items && typeof schema.items === 'object') {
    return needsOpenAIStrictTransform(schema.items as Record<string, unknown>);
  }

  return false;
}
