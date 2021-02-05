-- preamble: common routines

local JSON = require("JSON")

-- silence JSON parsing errors
function JSON:assert () end  -- luacheck: no unused args

local color = require('color')
local w = require('tables').wrap
local matchers = require('matchers')

local parser = clink.arg.new_parser

local function get_garn_meta(garn_path)
    local full_path = garn_path .. "buildsystem/.buildcache/.garn-meta.json"
    local garn_file = io.open(full_path)
    if garn_file == nil then return nil end

    local garn_file_contents = garn_file:read("*a")
    garn_file:close()

    return JSON:decode(garn_file_contents)
end

local function add_flags(garn_parser, garn_meta)
    for k, v in pairs(garn_meta.flags) do
        if #v == 0 then
            garn_parser:add_flags(k)
        else
            garn_parser:add_flags(k..parser(v))
        end
    end
end

local function rec_parse(tbl, garn_meta)
    local commands = {}
    for k, v in pairs(tbl) do
        if type(k) == "number" then
            table.insert(commands, v)
        else
            local plugin_parser = parser(rec_parse(v, garn_meta))
            add_flags(plugin_parser, garn_meta)
            table.insert(commands, k..plugin_parser)
        end
    end
    return commands
end

local function tasks(garn_meta)
    local parserTasks = rec_parse(garn_meta.tasks, garn_meta)
    return parserTasks
end

local function plugins(garn_meta)
    local parserPlugins = rec_parse(garn_meta.plugins, garn_meta)
    return parserPlugins
end

function trim(s)
   return (s:gsub("^%s*(.-)%s*$", "%1"))
end

-- So this may look a little odd, but we need to fake a parser
-- since plugins has nested arguments. You can register a function
-- as a parser argument, but such a function is only allowed to return
-- a table of strings, and an item in such a list can't be a sub parser.
-- We also need to do this to find the correct garn instance and the meta
-- for that instance.
local fake_parser = parser()
fake_parser.go = function (this_parser, parts)
    local leading = rl_state.line_buffer:sub(1, rl_state.first - 1)

    local pos = leading:find("garn ")
    if pos == nil then
        pos = leading:find("garn.cmd ")
    end
    local garn_path = trim(leading:sub(1, pos - 1))
    local garn_meta = get_garn_meta(garn_path)
    if garn_meta == nil then
        print ("")
        print ("Could not find a .garn-meta.json in " .. garn_path .. "buildsystem/.buildcache/, try running garn once to build the meta file")
        print ("")
        return
    end
    local garn_parser = parser({plugins(garn_meta), tasks(garn_meta)})
    add_flags(garn_parser, garn_meta)
    
    this_parser.flags = garn_parser.flags
    this_parser.arguments = garn_parser.arguments
    this_parser.precise = garn_parser.precise
    this_parser.use_file_matching = garn_parser.use_file_matching
    this_parser.loop_point = garn_parser.loop_point
    return garn_parser.go(this_parser, parts)
end

clink.arg.register_parser("garn", fake_parser)
