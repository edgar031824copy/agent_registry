#!/usr/bin/env node
import { Command } from 'commander'
import { makePushCommand } from './commands/push'
import { makePullCommand } from './commands/pull'
import { makeListCommand } from './commands/list'
import { makeEvalCommand } from './commands/eval'
import { makeRunCommand } from './commands/run'

const program = new Command()

program
  .name('agent')
  .description('Agent Registry CLI — push, pull, list, and compare agent versions')
  .version('1.0.0')

program.addCommand(makePushCommand())
program.addCommand(makePullCommand())
program.addCommand(makeListCommand())
program.addCommand(makeEvalCommand())
program.addCommand(makeRunCommand())

program.parse()
