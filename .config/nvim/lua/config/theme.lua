-- Persist the last-chosen colorscheme across sessions.
-- Any `:colorscheme X` (including the snacks picker) is written to a state
-- file and restored on the next startup.
local M = {}

local state_file = vim.fs.joinpath(vim.fn.stdpath("state"), "theme.txt")

function M.saved()
  local f = io.open(state_file, "r")
  if not f then
    return nil
  end
  local name = vim.trim(f:read("*a") or "")
  f:close()
  return name ~= "" and name or nil
end

---@param default string colorscheme used when nothing has been persisted yet
function M.setup(default)
  vim.api.nvim_create_autocmd("ColorScheme", {
    group = vim.api.nvim_create_augroup("theme-persist", { clear = true }),
    callback = function(ev)
      local f = io.open(state_file, "w")
      if f then
        f:write(ev.match)
        f:close()
      end
    end,
  })
  local ok = pcall(vim.cmd.colorscheme, M.saved() or default)
  if not ok then
    vim.cmd.colorscheme(default)
  end
end

return M
