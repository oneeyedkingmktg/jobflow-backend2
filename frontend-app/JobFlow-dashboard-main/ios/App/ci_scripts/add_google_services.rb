require 'xcodeproj'

project_path = ARGV[0]
raise "Usage: add_google_services.rb <path/to/App.xcodeproj>" unless project_path

project = Xcodeproj::Project.open(project_path)
target = project.targets.find { |t| t.name == 'App' }
raise "Could not find App target" unless target

app_group = project.main_group.find_subpath('App', false)
raise "Could not find App group" unless app_group

# Only add if not already present
if app_group.files.any? { |f| f.path == 'GoogleService-Info.plist' }
  puts ">>> GoogleService-Info.plist already in project, skipping."
else
  file_ref = app_group.new_file('GoogleService-Info.plist')
  target.add_resources([file_ref])
  project.save
  puts ">>> GoogleService-Info.plist added to App target."
end
