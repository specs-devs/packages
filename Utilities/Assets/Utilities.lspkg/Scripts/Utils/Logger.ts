/**
 * Specs Inc. 2026
 * Centralized logging utility for consistent log formatting across the package.
 * Provides tagged logging with optional debug mode toggling and beautifully formatted output.
 */

/**
 * Logger utility class for consistent, formatted logging across scripts
 */
export class Logger {
  private tag: string;
  private debugEnabled: boolean;
  private useColors: boolean;

  // ANSI color codes for terminal output
  private readonly COLORS = {
    RESET: "\x1b[0m",
    BRIGHT: "\x1b[1m",
    DIM: "\x1b[2m",

    // Foreground colors
    BLACK: "\x1b[30m",
    RED: "\x1b[31m",
    GREEN: "\x1b[32m",
    YELLOW: "\x1b[33m",
    BLUE: "\x1b[34m",
    MAGENTA: "\x1b[35m",
    CYAN: "\x1b[36m",
    WHITE: "\x1b[37m",

    // Background colors
    BG_BLACK: "\x1b[40m",
    BG_RED: "\x1b[41m",
    BG_GREEN: "\x1b[42m",
    BG_YELLOW: "\x1b[43m",
    BG_BLUE: "\x1b[44m",
    BG_MAGENTA: "\x1b[45m",
    BG_CYAN: "\x1b[46m",
    BG_WHITE: "\x1b[47m",
  };

  /**
   * Creates a new Logger instance
   * @param tag - The tag to prefix all log messages with
   * @param debugEnabled - Whether debug logging is enabled (default: true)
   * @param useColors - Whether to use colored output (default: true)
   */
  constructor(tag: string, debugEnabled: boolean = true, useColors: boolean = true) {
    this.tag = tag;
    this.debugEnabled = debugEnabled;
    this.useColors = useColors;
  }

  /**
   * Formats a message with optional color and styling
   * @param level - Log level string
   * @param message - The message content
   * @param color - ANSI color code (unused in Lens Studio, kept for API compatibility)
   * @returns Formatted message string
   */
  private format(level: string, message: string, color: string): string {
    const timestamp = new Date().toISOString().substr(11, 8);
    // Simple pipe-separated format for better readability in Lens Studio console
    return `${timestamp} | ${this.tag} | ${level} | ${message}`;
  }

  /**
   * Logs an informational message with nice formatting (only if logging is enabled)
   * @param message - The message to log
   */
  info(message: string): void {
    if (!this.debugEnabled) return;
    const formatted = this.format("INFO", message, this.COLORS.GREEN);
    print(formatted);
  }

  /**
   * Logs a debug message (only if debug mode is enabled)
   * @param message - The message to log
   */
  debug(message: string): void {
    if (!this.debugEnabled) return;
    const formatted = this.format("DEBUG", message, this.COLORS.BLUE);
    print(formatted);
  }

  /**
   * Logs a warning message (only if logging is enabled)
   * @param message - The message to log
   */
  warn(message: string): void {
    if (!this.debugEnabled) return;
    const formatted = this.format("WARN", message, this.COLORS.YELLOW);
    print(formatted);
  }

  /**
   * Logs an error message (only if logging is enabled)
   * @param message - The message to log
   */
  error(message: string): void {
    if (!this.debugEnabled) return;
    const formatted = this.format("ERROR", message, this.COLORS.RED);
    print(formatted);
  }

  /**
   * Logs a success message (only if logging is enabled)
   * @param message - The message to log
   */
  success(message: string): void {
    if (!this.debugEnabled) return;
    const formatted = this.format("SUCCESS", message, this.COLORS.GREEN + this.COLORS.BRIGHT);
    print(formatted);
  }

  /**
   * Logs a separator line for visual organization (only if logging is enabled)
   * @param char - Character to use for the line (default: "-")
   * @param length - Length of the separator (default: 80)
   */
  separator(char: string = "-", length: number = 80): void {
    if (!this.debugEnabled) return;
    print(`${"".padStart(length, char)}`);
  }

  /**
   * Logs a header message with surrounding separators (only if logging is enabled)
   * @param message - The header message
   */
  header(message: string): void {
    if (!this.debugEnabled) return;
    this.separator("=", 80);
    print(`| ${message.toUpperCase()}`);
    this.separator("=", 80);
  }

  /**
   * Enables or disables debug logging
   * @param enabled - Whether debug logging should be enabled
   */
  setDebugEnabled(enabled: boolean): void {
    this.debugEnabled = enabled;
  }

  /**
   * Enables or disables colored output
   * @param enabled - Whether colored output should be enabled
   */
  setColorsEnabled(enabled: boolean): void {
    this.useColors = enabled;
  }
}
