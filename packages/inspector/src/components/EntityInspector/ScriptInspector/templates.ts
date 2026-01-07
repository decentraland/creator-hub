import { toPascalCase } from '../../../lib/utils/strings';

export function getScriptTemplateClass(scriptName: string): string {
  const className = toPascalCase(scriptName, 'Script') || 'Script';
  return `
import { engine, Entity } from '@dcl/sdk/ecs'
// Add any additional import statements above

export class ${className} {
  /**
   * Properties
   * Define class fields you want to reuse across methods.
   * Example usage: this.myVariable
   */
   // private myVariable: boolean = true
  
  /**
   * Constructor / Inputs
   * Parameters declared here appear in the Script component UI in Creator Hub.
   * Supported types: Entity, String, Number, Boolean.
   *
   * Note: After editing this file, click the refresh icon in the Script component UI
   * to see updated inputs.
   */
  constructor(
    public src: string,     // DO NOT REMOVE
    public entity: Entity,   // DO NOT REMOVE
    // Add your custom inputs below
  ) {}

  /**
   * start()
   * Called once when the script is initialized.
   */
  start() {
    // Script initialization
    console.log("${className} initialized for entity:", this.entity);
  }

  /**
   * update(dt)
   * Called every frame.
   * @param dt - (optional) Delta time since last frame (in seconds)
   */
  update(dt: number) {
    // Called every frame
  }
}
`;
}
