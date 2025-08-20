import chalk from 'chalk';

chalk.level = 3; // 强制启用颜色

function safeText(message) {
  if (typeof message === 'string') {
    return Buffer.from(message, 'utf8').toString();
  }
  return message;
}

class Logger {
  static info(...message) {
    console.log(chalk.blue('[INFO]'), ...message.map(safeText));
  }

  static warn(...message) {
    console.log(chalk.yellow('[WARN]'), ...message.map(safeText));
  }

  static error(...message) {
    console.log(chalk.red('[ERROR]'), ...message.map(safeText));
  }

  static success(...message) {
    console.log(chalk.green('[SUCCESS]'), ...message.map(safeText));
  }

  static debug(...message) {
    console.log(chalk.magenta('[DEBUG]'), ...message.map(safeText));
  }

  static log(...message) {
    console.log(chalk.white('[LOG]'), ...message.map(safeText));
  }
}


export default Logger;